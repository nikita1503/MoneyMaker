import { NextResponse } from "next/server";
import { autocompleteV2 } from "@/lib/crustdata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/autocomplete?field=taxonomy.professional_network_industry&q=software
// Thin proxy around Crustdata's autocomplete endpoint so the browser never
// needs the API key.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const field = url.searchParams.get("field") ?? "";
  const q = url.searchParams.get("q") ?? "";
  if (!field) return NextResponse.json({ error: "field required" }, { status: 400 });
  try {
    const suggestions = await autocompleteV2(field, q);
    return NextResponse.json({ suggestions });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message ?? e) }, { status: 500 });
  }
}
