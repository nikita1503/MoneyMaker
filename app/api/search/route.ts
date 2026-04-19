import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/crustdata";
import { STEP1_FILTERS, TOP_N, rankCompanies } from "@/lib/heuristics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// How many pages to pull from Crustdata before we rank. The post-filter
// "no real website" can drop the majority of rows, so we walk a few pages
// to give rankCompanies a healthy candidate pool.
const MAX_PAGES = 10;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topN = Number(body.topN ?? TOP_N);
    const maxPages = Number(body.maxPages ?? MAX_PAGES);
    const filters = body.filters ?? STEP1_FILTERS;

    // Walk pages sequentially. Crustdata is 1-indexed; parallel fan-out
    // occasionally rate-limits and the .catch would hide that silently.
    const all: any[] = [];
    const pageErrors: string[] = [];
    for (let i = 1; i <= maxPages; i++) {
      try {
        const batch = await searchCompanies(filters, i);
        all.push(...batch);
        if (batch.length === 0) break; // out of results
      } catch (e: any) {
        pageErrors.push(`page ${i}: ${String(e.message ?? e).slice(0, 200)}`);
        break;
      }
    }
    const ranked = rankCompanies(all, topN);

    return NextResponse.json({
      totalFound: all.length,
      pagesFetched: maxPages,
      afterFilter: ranked.length,
      ranked,
      filtersUsed: filters,
      pageErrors: pageErrors.length ? pageErrors : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message ?? e) }, { status: 500 });
  }
}
