import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/crustdata";
import { STEP1_FILTERS, TOP_N, rankCompanies } from "@/lib/heuristics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const page = Number(body.page ?? 1);
    const topN = Number(body.topN ?? TOP_N);
    const filters = body.filters ?? STEP1_FILTERS;

    const all = await searchCompanies(filters, page);
    const ranked = rankCompanies(all, topN);

    return NextResponse.json({
      totalFound: all.length,
      ranked,
      filtersUsed: filters,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message ?? e) }, { status: 500 });
  }
}
