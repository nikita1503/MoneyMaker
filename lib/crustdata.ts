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
  qs.set("fields", "job_openings,news_articles,funding_and_investment,web_traffic,tech_stack");

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

// People search — used to find the founder / highest-rank contact for outreach
export async function searchPeople(body: Record<string, any>): Promise<any[]> {
  const res = await fetch(`${BASE}/screener/people/search`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`crustdata people ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  // Response shape varies; try common containers.
  return (data.profiles ?? data.people ?? data.results ?? []) as any[];
}

// Best-effort: find a founder or top-rank contact at a company.
// Crustdata people search is versioned — if a filter shape fails we degrade.
export async function findTopContact(opts: {
  companyName?: string;
  linkedinCompanyId?: string;
  domain?: string;
}): Promise<{ name?: string; email?: string; title?: string } | null> {
  const attempts: Record<string, any>[] = [];

  if (opts.linkedinCompanyId) {
    attempts.push({
      filters: [
        { filter_type: "CURRENT_COMPANY_LINKEDIN_ID", type: "in", value: [opts.linkedinCompanyId] },
        { filter_type: "TITLE", type: "in", value: ["CEO", "Founder", "Co-Founder", "Chief Executive Officer"] },
      ],
      page: 1,
    });
  }
  if (opts.companyName) {
    attempts.push({
      filters: [
        { filter_type: "CURRENT_COMPANY", type: "in", value: [opts.companyName] },
        { filter_type: "TITLE", type: "in", value: ["CEO", "Founder"] },
      ],
      page: 1,
    });
  }

  for (const body of attempts) {
    try {
      const people = await searchPeople(body);
      if (people.length === 0) continue;
      // Prefer someone with an email.
      const withEmail = people.find((p) => p.email || p.business_email || p.personal_email);
      const pick = withEmail ?? people[0];
      return {
        name: pick.name ?? pick.full_name,
        email: pick.email ?? pick.business_email ?? pick.personal_email,
        title: pick.title ?? pick.current_title ?? pick.headline,
      };
    } catch {
      // Try next attempt
    }
  }
  return null;
}
