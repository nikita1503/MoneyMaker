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

// Target local-service verticals where a website is an actual sales pain —
// restaurants, contractors, salons, fitness studios, indie retail, realtors.
// These businesses convert customers off-site (bookings, walk-ins, directions),
// so a mocked landing page has obvious sales utility. Steel mills and B2B SaaS
// with seven-figure ACVs do not feel this pain.
//
// We deliberately use LinkedIn's industry taxonomy strings here because the v1
// `/screener/company/search` filter is case-sensitive and must match exactly.
// Headcount 2–50 skews to mom-and-pop size — the sweet spot for a $X flat-fee
// freelance website pitch.
// v1 `/screener/company/search` filters. No industry gate — we'd rather cast
// wider and let the post-filter (`hasNoRealWebsite`) + scoring pick the best
// prospects. Regions use LinkedIn's long-form country strings.
export const STEP1_FILTERS: SearchFilter[] = [
  { filter_type: "COMPANY_HEADCOUNT", type: "in", value: ["1-10", "11-50"] },
  {
    filter_type: "REGION",
    type: "in",
    value: ["United States", "Canada", "United Kingdom", "Australia"],
  },
];

// v2 `/company/search` filters. Same intent, different shape — v2 takes a
// native `basic_info.website = ""` predicate, which lets the server return
// only no-website records (enormous pool-size win). Country codes are 3-letter
// ISO on v2 (USA / CAN / GBR / AUS), not long-form strings.
export const STEP1_FILTERS_V2 = {
  op: "and" as const,
  conditions: [
    { field: "basic_info.website", type: "=", value: "" },
    { field: "locations.country", type: "in", value: ["USA", "CAN", "GBR", "AUS"] },
    {
      field: "basic_info.employee_count_range",
      type: "in",
      value: ["2-10", "11-50"],
    },
  ],
};

export const TOP_N = 8;

// Hosts that almost always mean "this company doesn't have a real website yet":
// LinkedIn pages used as homepage, builder default subdomains, dev-hosting URLs
// that shouldn't be a production homepage. Keep lowercased.
const PLACEHOLDER_HOSTS = [
  // Social / link-in-bio used as homepage
  "linkedin.com",
  "linktr.ee",
  "beacons.ai",
  "about.me",
  "ycombinator.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "threads.net",
  "pinterest.com",
  "yelp.com",
  "nextdoor.com",
  "tripadvisor.com",
  "opentable.com",
  "grubhub.com",
  "doordash.com",
  "ubereats.com",
  "etsy.com",
  "amazon.com",
  "ebay.com",
  "shopify.com",
  "bigcartel.com",
  // Link shorteners — no real site if the homepage is a shortener
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "lnkd.in",
  "rebrand.ly",
  "ow.ly",
  "buff.ly",
  "goo.gl",
  // No-code / drag-and-drop builders on their default subdomain
  "carrd.co",
  "strikingly.com",
  "wix.com",
  "wixsite.com",
  "weebly.com",
  "webnode.com",
  "godaddysites.com",
  "squarespace.com",
  "square.site",
  "notion.site",
  "notion.so",
  "substack.com",
  "medium.com",
  "webflow.io",
  "framer.website",
  "framer.ai",
  "bubble.io",
  "canva.site",
  "my.canva.site",
  "mailchimpsites.com",
  "ucraft.site",
  "jimdofree.com",
  "jimdosite.com",
  // Legacy free-hosting / blog platforms
  "wordpress.com",
  "blogspot.com",
  "tumblr.com",
  "livejournal.com",
  "geocities.ws",
  "tripod.com",
  "angelfire.com",
  "sites.google.com",
  // Dev-hosting defaults that shouldn't be a production homepage
  "github.io",
  "gitbook.io",
  "herokuapp.com",
  "vercel.app",
  "netlify.app",
  "firebaseapp.com",
  "replit.app",
  "glitch.me",
  "pages.dev",
  "onrender.com",
];

// Classification of a company's public website.
// "empty" — the record has no `website` at all. Strongest prospect signal.
// "placeholder" — the website is a LinkedIn page / linktr.ee / bit.ly / carrd /
//     webflow default subdomain / github.io / vercel.app / etc. Still a
//     prospect but a weaker one — they tried to stand something up.
// "real" — a real domain. Skip.
export type WebsiteStatus = "empty" | "placeholder" | "real";

export function websiteStatus(c: SearchCompany): WebsiteStatus {
  const raw = (c.website ?? c.company_website_domain ?? "").trim();
  if (!raw) return "empty";

  const host = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
  if (!host) return "empty";

  if (PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return "placeholder";
  }
  return "real";
}

export function hasNoRealWebsite(c: SearchCompany): boolean {
  return websiteStatus(c) !== "real";
}

// Score each company. Higher = better prospect. Precondition: caller has
// already dropped companies with real websites via hasNoRealWebsite().
//
// The single strongest signal is the website status. Industry + size are
// secondary — we're targeting small local businesses where a website is a
// sales pain, and a bigger store with more walk-in traffic pays more.
export function scoreCompany(c: SearchCompany): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Website status — the whole premise of the pitch.
  const ws = websiteStatus(c);
  if (ws === "empty") {
    score += 50;
    reasons.push("no website on record");
  } else {
    // placeholder — link-in-bio / builder default / LinkedIn as homepage.
    score += 30;
    const host = (c.website ?? "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0];
    reasons.push(`placeholder only: ${host || "linkedin"}`);
  }

  // 2. Local-service industry — the verticals where a website actually closes
  // or loses business. (This is also a STEP1_FILTERS value, so all survivors
  // match — we record it as a reason for UI, no extra points.)
  const LOCAL_SERVICE = new Set([
    "Restaurants",
    "Construction",
    "Personal Care Services",
    "Retail",
    "Wellness and Fitness Services",
    "Real Estate",
  ]);
  if (c.industry && LOCAL_SERVICE.has(c.industry)) {
    reasons.push(`${c.industry.toLowerCase()} — website is a sales pain`);
  }

  // 3. Headcount band — prefer 1–50 (mom-and-pop to small team, the pitchable
  // sweet spot). 1–10 especially: one owner, one decision.
  const emp = c.employee_count ?? 0;
  if (emp >= 1 && emp <= 10) {
    score += 15;
    reasons.push(`${emp} employees — owner is the decision-maker`);
  } else if (emp >= 11 && emp <= 50) {
    score += 10;
    reasons.push(`${emp} employees`);
  }

  // 4. Decision-maker density — someone exists to pitch to.
  const dm = Number(c.decision_makers_count ?? 0);
  if (dm >= 1 && dm <= 10) {
    score += 10;
    reasons.push(`${dm} decision-maker${dm === 1 ? "" : "s"} reachable`);
  }

  // 5. Specialties listed → concrete content we can tailor copy to.
  if (c.specialties && c.specialties.length >= 3) {
    score += 5;
    reasons.push("rich specialties list to tailor copy");
  }

  // 6. Location specificity — a city/state lets us say "the go-to <vertical>
  // in <city>" in the headline.
  if (c.headquarters?.city) {
    score += 5;
    reasons.push(`based in ${c.headquarters.city}`);
  }

  return { score, reasons };
}

export function rankCompanies(companies: SearchCompany[], topN = TOP_N): RankedCompany[] {
  // Paginated searches can return the same company twice; dedupe on
  // linkedin_company_id (or falling back to normalised name).
  const seen = new Set<string>();
  const unique: SearchCompany[] = [];
  for (const c of companies) {
    const key = c.linkedin_company_id || (c.name ?? "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  // Hard filter: only companies that look like they don't have a real website.
  const needSite = unique.filter(hasNoRealWebsite);
  return needSite
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
