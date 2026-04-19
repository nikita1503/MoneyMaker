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
