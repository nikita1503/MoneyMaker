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

    // Walk pages sequentially. Crustdata is 1-indexed and occasionally
    // times out on deep pages — retry once, then skip that page and keep
    // going. Two consecutive empty pages is our stop signal.
    const all: any[] = [];
    const pageErrors: string[] = [];
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
