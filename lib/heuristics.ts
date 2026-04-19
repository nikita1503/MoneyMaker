// ---------------------------------------------------------------------------
// Heuristics — tweak here. The product spec says these will evolve.
// ---------------------------------------------------------------------------
// STEP-1 filters narrow the Crustdata search. Think of this as:
//   "companies likely to need a fresh website and likely to pay a freelancer."
//
// STEP-2 scoring ranks the search results so we only generate pages for the
// top-N most promising targets. Each heuristic contributes points.
// ---------------------------------------------------------------------------

import type { RankedCompany, SearchCompany } from "./types";
import type { SearchFilter } from "./crustdata";

export const STEP1_FILTERS: SearchFilter[] = [
  // Young-ish software companies — likely on a starter template site.
  { filter_type: "INDUSTRY", type: "in", value: ["Software Development"] },
  { filter_type: "COMPANY_HEADCOUNT", type: "in", value: ["11-50", "51-200"] },
  { filter_type: "REGION", type: "in", value: ["United States"] },
  // Revenue is applied as a *scoring* signal in scoreCompany() rather than a hard
  // filter: the live ANNUAL_REVENUE filter excludes records with null revenue and
  // produces empty result sets even for broad bands.
];

export const TOP_N = 8;

// Step 2: score each company. Higher = better prospect.
export function scoreCompany(c: SearchCompany): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Funded but small → likely rushed their site.
  const maxRev = c.revenue_range?.estimatedMaxRevenue;
  if (maxRev) {
    const usd =
      maxRev.unit === "BILLION"
        ? maxRev.amount * 1e9
        : maxRev.unit === "MILLION"
          ? maxRev.amount * 1e6
          : maxRev.amount;
    if (usd >= 2_000_000 && usd <= 100_000_000) {
      score += 20;
      reasons.push("revenue in sweet spot ($2M–$100M)");
    }
  }

  // Hiring / growing quickly → investing in growth, has budget.
  const yoy = c.employee_growth_percentages?.find((g) => g.timespan === "YEAR");
  if (yoy && yoy.percentage >= 20) {
    score += 15;
    reasons.push(`${yoy.percentage}% YoY headcount growth`);
  } else if (yoy && yoy.percentage >= 5) {
    score += 5;
    reasons.push(`${yoy.percentage}% YoY headcount growth`);
  }

  // Decision-maker density.
  const dm = Number(c.decision_makers_count ?? 0);
  if (dm >= 3 && dm <= 30) {
    score += 10;
    reasons.push(`${dm} decision-makers (good outreach surface)`);
  }

  // Young → smaller budget for design, more likely to accept a freelance pitch.
  if (c.founded_year && c.founded_year >= 2018) {
    score += 10;
    reasons.push(`founded ${c.founded_year}`);
  }

  // Headcount band — prefer 11–100.
  if (c.employee_count && c.employee_count >= 11 && c.employee_count <= 100) {
    score += 10;
    reasons.push(`${c.employee_count} employees`);
  }

  // Specialties listed → we can tailor copy.
  if (c.specialties && c.specialties.length >= 3) {
    score += 5;
    reasons.push("rich specialties list to tailor copy");
  }

  return { score, reasons };
}

export function rankCompanies(companies: SearchCompany[], topN = TOP_N): RankedCompany[] {
  return companies
    .map((c, i) => {
      const { score, reasons } = scoreCompany(c);
      return {
        ...c,
        id: stableId(c, i),
        score,
        reasons,
        domain: c.company_website_domain ?? undefined,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

function stableId(c: SearchCompany, i: number): string {
  const base =
    c.linkedin_company_id ||
    c.company_website_domain ||
    c.name ||
    `c${i}`;
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
