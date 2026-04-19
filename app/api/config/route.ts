import { NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await loadConfig());
}

export async function POST(req: Request) {
  const body = await req.json();
  const c = await saveConfig(body);
  return NextResponse.json(c);
}
