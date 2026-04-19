import { NextResponse } from "next/server";
import { searchCompanies, searchCompaniesV2, useV2 } from "@/lib/crustdata";
import { STEP1_FILTERS, STEP1_FILTERS_V2, TOP_N, rankCompanies } from "@/lib/heuristics";

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

    if (version === "v2") {
      // v2: cursor-paginate through the native-filtered results.
      const filters = body.filtersV2 ?? STEP1_FILTERS_V2;
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
      const filters = body.filters ?? STEP1_FILTERS;
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
