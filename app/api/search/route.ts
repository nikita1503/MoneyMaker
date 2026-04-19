import { NextResponse } from "next/server";
import { searchCompanies, searchCompaniesV2, useV2 } from "@/lib/crustdata";
import type { V2Condition, V2Filters } from "@/lib/crustdata";
import { STEP1_FILTERS, STEP1_FILTERS_V2, TOP_N, rankCompanies } from "@/lib/heuristics";

// UI-sourced filter selections. All fields optional.
type UserFilters = {
  industries?: string[];  // taxonomy.professional_network_industry IN ...
  countries?: string[];   // locations.country IN [ISO3,...]
  fundingMin?: number;    // funding.total_investment_usd >=
  fundingMax?: number;    // funding.total_investment_usd <=
  revenueMin?: number;    // revenue.estimated.upper_bound_usd >=
  revenueMax?: number;    // revenue.estimated.upper_bound_usd <=
};

// Merge user selections into the v2 filter AND-tree, preserving the default
// "no real website" predicate + headcount band from STEP1_FILTERS_V2.
function buildV2Filters(u: UserFilters): V2Filters {
  // Clone the defaults so we don't mutate the exported constant across calls.
  const base = STEP1_FILTERS_V2;
  const conditions: V2Condition[] = base.conditions.map((c) => ({ ...c }));

  if (u.industries && u.industries.length) {
    // Override the default country list? No — industries + countries AND together.
    conditions.push({
      field: "taxonomy.professional_network_industry",
      type: "in",
      value: u.industries,
    });
  }
  if (u.countries && u.countries.length) {
    // Replace the default country list with the user's selection — more
    // intuitive than AND-narrowing (which would produce 0 rows when user
    // picks a country not in the default [USA, CAN, GBR, AUS]).
    const idx = conditions.findIndex((c) => c.field === "locations.country");
    if (idx >= 0) conditions[idx] = { field: "locations.country", type: "in", value: u.countries };
    else conditions.push({ field: "locations.country", type: "in", value: u.countries });
  }
  // v2 uses Yoda-style operators: "=>" for >=, "=<" for <= (verified live).
  if (typeof u.fundingMin === "number" && !Number.isNaN(u.fundingMin)) {
    conditions.push({ field: "funding.total_investment_usd", type: "=>", value: u.fundingMin });
  }
  if (typeof u.fundingMax === "number" && !Number.isNaN(u.fundingMax)) {
    conditions.push({ field: "funding.total_investment_usd", type: "=<", value: u.fundingMax });
  }
  if (typeof u.revenueMin === "number" && !Number.isNaN(u.revenueMin)) {
    conditions.push({ field: "revenue.estimated.upper_bound_usd", type: "=>", value: u.revenueMin });
  }
  if (typeof u.revenueMax === "number" && !Number.isNaN(u.revenueMax)) {
    conditions.push({ field: "revenue.estimated.upper_bound_usd", type: "=<", value: u.revenueMax });
  }
  return { op: "and", conditions };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// How many pages to pull from Crustdata before we rank. The post-filter
// "no real website" drops the majority of v1 rows, so we walk a lot of pages
// to give rankCompanies a healthy candidate pool. On v2 the server-side
// `basic_info.website = ""` predicate means every page is already filtered,
// so fewer pages are needed — v2 uses V2_PAGE_SIZE rows per page instead.
const MAX_PAGES = 20;
const V2_PAGE_SIZE = 100;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topN = Number(body.topN ?? TOP_N);
    const maxPages = Number(body.maxPages ?? MAX_PAGES);
    const version = useV2() ? "v2" : "v1";

    const all: any[] = [];
    const pageErrors: string[] = [];
    let totalCount: number | null = null;

    // Merge any user-supplied filter selections from the UI.
    const userFilters: UserFilters = {
      industries: body.industries,
      countries: body.countries,
      fundingMin: body.fundingMin,
      fundingMax: body.fundingMax,
      revenueMin: body.revenueMin,
      revenueMax: body.revenueMax,
    };

    if (version === "v2") {
      // v2: cursor-paginate through the native-filtered results.
      const filters = body.filtersV2 ?? buildV2Filters(userFilters);
      let cursor: string | null = null;
      for (let i = 0; i < maxPages; i++) {
        try {
          const { companies, totalCount: tc, nextCursor } = await searchCompaniesV2(
            filters,
            { limit: V2_PAGE_SIZE, cursor }
          );
          if (totalCount === null) totalCount = tc;
          if (companies.length > 0) all.push(...companies);
          if (!nextCursor) break; // end of feed
          cursor = nextCursor;
        } catch (e: any) {
          pageErrors.push(`v2 page ${i + 1}: ${String(e.message ?? e).slice(0, 160)}`);
          break;
        }
      }
    } else {
      // v1: 1-indexed page walk with retry + continue-past-failure.
      // Applies user industry + country selections. Funding and revenue don't
      // translate cleanly to v1 filter names, so they're ignored on this path.
      const filters: import("@/lib/crustdata").SearchFilter[] =
        body.filters ?? [...STEP1_FILTERS];
      if (userFilters.industries?.length) {
        filters.push({ filter_type: "INDUSTRY", type: "in", value: userFilters.industries });
      }
      if (userFilters.countries?.length) {
        // v1 uses long-form names; if the user picks ISO3 codes we map a few.
        const iso3ToName: Record<string, string> = {
          USA: "United States", CAN: "Canada", GBR: "United Kingdom",
          AUS: "Australia", IND: "India", DEU: "Germany", FRA: "France",
          ESP: "Spain", ITA: "Italy", NLD: "Netherlands", IRL: "Ireland",
          SGP: "Singapore", JPN: "Japan", BRA: "Brazil", MEX: "Mexico",
        };
        const regions = userFilters.countries.map((c) => iso3ToName[c] ?? c);
        const idx = filters.findIndex((f) => f.filter_type === "REGION");
        if (idx >= 0) filters[idx] = { filter_type: "REGION", type: "in", value: regions };
        else filters.push({ filter_type: "REGION", type: "in", value: regions });
      }
      let consecutiveEmpty = 0;
      for (let i = 1; i <= maxPages; i++) {
        let batch: any[] | null = null;
        for (let attempt = 0; attempt < 2 && batch === null; attempt++) {
          try {
            batch = await searchCompanies(filters, i);
          } catch (e: any) {
            const msg = `page ${i} attempt ${attempt + 1}: ${String(e.message ?? e).slice(0, 160)}`;
            pageErrors.push(msg);
            if (attempt === 1) batch = [];
          }
        }
        if (!batch || batch.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) break;
        } else {
          consecutiveEmpty = 0;
          all.push(...batch);
        }
      }
    }

    const ranked = rankCompanies(all, topN);
    return NextResponse.json({
      version,
      totalFound: all.length,
      totalCount,
      pagesFetched: maxPages,
      afterFilter: ranked.length,
      ranked,
      pageErrors: pageErrors.length ? pageErrors : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message ?? e) }, { status: 500 });
  }
}
