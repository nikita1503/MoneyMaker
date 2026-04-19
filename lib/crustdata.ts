import type { EnrichedCompany, SearchCompany } from "./types";

const BASE = "https://api.crustdata.com";

function token() {
  const t = process.env.CRUSTDATA_API_KEY;
  if (!t) throw new Error("CRUSTDATA_API_KEY not set in .env.local");
  return t;
}

function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Token ${token()}`,
    Accept: "application/json",
    ...extra,
  };
}

function headersV2(extra: Record<string, string> = {}) {
  return {
    authorization: `Bearer ${token()}`,
    "x-api-version": "2025-11-01",
    Accept: "application/json",
    ...extra,
  };
}

export function useV2(): boolean {
  return process.env.CRUSTDATA_USE_V2 === "true" || process.env.CRUSTDATA_API_VERSION === "v2";
}

export type SearchFilter = {
  filter_type: string;
  type: "in" | "not in" | "between";
  value: (string | number)[];
};

export async function searchCompanies(
  filters: SearchFilter[],
  page = 1
): Promise<SearchCompany[]> {
  const res = await fetch(`${BASE}/screener/company/search`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ filters, page }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`crustdata search ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as { companies?: SearchCompany[] };
  return data.companies ?? [];
}

// -----------------------------------------------------------------------
// v2 `/company/search` — gated behind a credit tier on your account. Enable
// with `CRUSTDATA_USE_V2=true` in `.env.local` once you have access.
//
// v2 differs from v1 in every dimension:
//   - URL:     /company/search (no /screener prefix)
//   - Auth:    Authorization: Bearer <key>       (v1 uses "Token")
//   - Header:  x-api-version: 2025-11-01 required
//   - Filters: { op, conditions: [{field, type, value}] } — not an array
//   - Fields:  dotted paths on nested objects (basic_info.website, etc.)
//   - Paging:  `limit` + `offset` per page (not a 1-indexed `page` number)
//   - Regions: ISO-3 country codes (USA, CAN, GBR) — not long-form strings
//
// The big win is the first-class `basic_info.website = ""` predicate: the
// server returns only no-website records, so we never post-filter. v1 has
// no equivalent — we burn 100s of rows per page looking for the needle.
//
// Response shape probed from error responses: `{ results: [...], total_count }`.
// The exact schema of a row is inferred (nested `basic_info`, `locations`,
// `taxonomy`, `headcount` groups). Adapter normalises to our flat
// `SearchCompany` so downstream code (rankCompanies, scoreCompany, the UI)
// doesn't need to know which API served the data.
// -----------------------------------------------------------------------

export type V2Condition = { field: string; type: string; value: any };
export type V2Filters = { op: "and" | "or"; conditions: V2Condition[] };

// Live response (verified 2026-04-19):
//   { companies: [...], next_cursor: "<opaque>" | null, total_count: N }
// Paginate by passing `cursor: next_cursor` on the next request. Passing
// `offset` is rejected with 400.
export async function searchCompaniesV2(
  filters: V2Filters,
  opts: { limit?: number; cursor?: string | null } = {}
): Promise<{
  companies: SearchCompany[];
  totalCount: number | null;
  nextCursor: string | null;
}> {
  const body: Record<string, any> = {
    filters,
    limit: opts.limit ?? 50,
  };
  if (opts.cursor) body.cursor = opts.cursor;
  const res = await fetch(`${BASE}/company/search`, {
    method: "POST",
    headers: headersV2({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.text();
    throw new Error(`crustdata v2 search ${res.status}: ${b.slice(0, 400)}`);
  }
  const data: any = await res.json();
  const rows: any[] = data.companies ?? data.results ?? [];
  return {
    companies: rows.map(adaptV2Row),
    totalCount: data.total_count ?? null,
    nextCursor: data.next_cursor ?? null,
  };
}

// Flatten a v2 nested row into our flat SearchCompany shape. Live field paths
// (verified 2026-04-19):
//   basic_info.{name, website, primary_domain, professional_network_url,
//               professional_network_id, year_founded, employee_count_range,
//               industries[]}
//   headcount.total                 — numeric employee count
//   locations.{country, state, city}
//   taxonomy.{professional_network_industry, professional_network_specialities[]}
//   revenue.estimated.{lower_bound_usd, upper_bound_usd}
function adaptV2Row(r: any): SearchCompany {
  const bi = r.basic_info ?? {};
  const loc = r.locations ?? {};
  const tax = r.taxonomy ?? {};
  const hc = r.headcount ?? {};
  const rev = r.revenue?.estimated ?? {};

  const website: string = bi.website ?? "";
  const domain =
    bi.primary_domain ||
    (website
      ? String(website).replace(/^https?:\/\//, "").replace(/\/.*$/, "")
      : undefined);

  return {
    name: bi.name ?? r.name ?? "",
    website,
    linkedin_company_url: bi.professional_network_url,
    linkedin_company_id: bi.professional_network_id,
    industry:
      tax.professional_network_industry ??
      (Array.isArray(bi.industries) ? bi.industries[0] : undefined),
    specialties: tax.professional_network_specialities ?? [],
    employee_count: hc.total ?? undefined,
    employee_count_range: bi.employee_count_range,
    founded_year: bi.year_founded ? Number(bi.year_founded) : undefined,
    location: [loc.city, loc.state, loc.country].filter(Boolean).join(", "),
    headquarters: {
      country: loc.country,
      geographicArea: loc.state,
      city: loc.city,
    },
    company_website_domain: domain,
    revenue_range:
      rev.upper_bound_usd != null
        ? {
            estimatedMaxRevenue: {
              amount: rev.upper_bound_usd,
              unit: "USD",
              currencyCode: "USD",
            },
            estimatedMinRevenue: {
              amount: rev.lower_bound_usd ?? rev.upper_bound_usd,
              unit: "USD",
              currencyCode: "USD",
            },
          }
        : undefined,
    // Preserve the v2 numeric id so downstream code can de-dupe across calls.
    // (We also use linkedin id below for dedupe.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(r.crustdata_company_id ? { crustdata_company_id: r.crustdata_company_id } : {}),
  } as SearchCompany;
}

export async function enrichCompany(opts: {
  domain?: string;
  name?: string;
  companyId?: number;
  realtime?: boolean;
}): Promise<EnrichedCompany[]> {
  const qs = new URLSearchParams();
  if (opts.domain) qs.set("company_domain", opts.domain);
  else if (opts.name) qs.set("company_name", opts.name);
  else if (opts.companyId) qs.set("company_id", String(opts.companyId));
  else throw new Error("enrichCompany: need domain, name, or companyId");
  if (opts.realtime) qs.set("enrich_realtime", "True");
  // Intentionally not passing `fields` — the default payload already returns the
  // firmographics + headcount + revenue bounds we need, and the opt-in field list
  // is picky (some names in the docs, e.g. `tech_stack`, are rejected by the live
  // API). Keep it minimal.

  const res = await fetch(`${BASE}/screener/company?${qs.toString()}`, {
    headers: headers(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`crustdata enrich ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as EnrichedCompany[];
  return Array.isArray(data) ? data : [];
}

// Guess a domain for a search-result company that doesn't carry one
export function guessDomain(c: SearchCompany): string | undefined {
  if (c.company_website_domain) return c.company_website_domain;
  if (c.website) return c.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return undefined;
}

// People search — used to find the founder / highest-rank contact for outreach.
// Endpoint is singular `/screener/person/search`. Live-verified valid
// filter_types include: CURRENT_COMPANY, CURRENT_TITLE, SENIORITY_LEVEL, …
// (not `TITLE`, not `CURRENT_COMPANY_LINKEDIN_ID` — those 400).
export async function searchPeople(body: Record<string, any>): Promise<any[]> {
  const res = await fetch(`${BASE}/screener/person/search`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`crustdata people ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  return (data.profiles ?? []) as any[];
}

function pickEmail(p: any): string | undefined {
  // Profile shape: `emails: string[]` (usually empty unless enriched).
  if (Array.isArray(p.emails) && p.emails.length) return p.emails[0];
  // Very old schema fallbacks.
  return p.email ?? p.business_email ?? p.personal_email;
}

function pickTitle(p: any): string | undefined {
  return p.current_title ?? p.default_position_title ?? p.headline ?? p.title;
}

// Best-effort: find the founder or top-rank contact at a company.
// Returns `null` only when the search endpoint itself throws or returns 0 rows.
// Returns `{name, title}` without `email` when Crustdata has the profile but no
// email attached — the caller then decides whether to skip or dev-redirect.
export async function findTopContact(opts: {
  companyName?: string;
  linkedinCompanyId?: string;
  domain?: string;
}): Promise<{ name?: string; email?: string; title?: string } | null> {
  if (!opts.companyName) return null;

  const queries: Record<string, any>[] = [
    // 1. Same company + founder/CEO title — the ideal prospect.
    {
      filters: [
        { filter_type: "CURRENT_COMPANY", type: "in", value: [opts.companyName] },
        { filter_type: "CURRENT_TITLE", type: "in", value: ["CEO", "Founder", "Co-Founder", "Chief Executive Officer", "Co-founder"] },
      ],
      page: 1,
    },
    // 2. Fall back to any decision-maker at the company.
    {
      filters: [
        { filter_type: "CURRENT_COMPANY", type: "in", value: [opts.companyName] },
        { filter_type: "SENIORITY_LEVEL", type: "in", value: ["Founder", "CXO", "Partner"] },
      ],
      page: 1,
    },
    // 3. Last resort — anyone at the company.
    {
      filters: [{ filter_type: "CURRENT_COMPANY", type: "in", value: [opts.companyName] }],
      page: 1,
    },
  ];

  for (const body of queries) {
    try {
      const people = await searchPeople(body);
      if (people.length === 0) continue;
      // Prefer someone with an email if any.
      const withEmail = people.find((p) => pickEmail(p));
      const decisionMaker = people.find((p) => p.default_position_is_decision_maker);
      const pick = withEmail ?? decisionMaker ?? people[0];
      return {
        name: pick.name ?? pick.full_name,
        email: pickEmail(pick),
        title: pickTitle(pick),
      };
    } catch {
      // Try next shape.
    }
  }
  return null;
}
