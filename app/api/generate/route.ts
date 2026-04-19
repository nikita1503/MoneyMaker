import { NextResponse } from "next/server";
import { enrichCompany, guessDomain } from "@/lib/crustdata";
import { planLandingPage, renderLandingHtml } from "@/lib/claude";
import { saveRun, saveSiteHtml } from "@/lib/storage";
import type { LandingPage, RankedCompany } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds, for long LLM calls

async function processCompany(c: RankedCompany): Promise<LandingPage> {
  try {
    const domain = c.domain ?? guessDomain(c);
    let enriched: any = null;
    if (domain) {
      const arr = await enrichCompany({ domain });
      enriched = arr[0] ?? null;
    }
    // Fallback: lookup by name.
    if (!enriched) {
      const arr = await enrichCompany({ name: c.name });
      enriched = arr[0] ?? null;
    }

    const bundle = { searchResult: c, enriched };
    const planMd = await planLandingPage(bundle);
    const html = await renderLandingHtml(planMd, c.name);
    const file = await saveSiteHtml(c.id, html);

    return {
      id: c.id,
      company: c,
      enriched,
      planMd,
      html,
      file,
      generatedAt: Date.now(),
    };
  } catch (e: any) {
    return {
      id: c.id,
      company: c,
      error: String(e.message ?? e),
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companies = (body.companies ?? []) as RankedCompany[];
    if (!Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json({ error: "companies[] required" }, { status: 400 });
    }
    const runId = `run-${Date.now()}`;

    // Process in parallel — spec explicitly asks for this.
    const pages = await Promise.all(companies.map(processCompany));
    await saveRun(runId, pages);

    return NextResponse.json({ runId, pages });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message ?? e) }, { status: 500 });
  }
}
