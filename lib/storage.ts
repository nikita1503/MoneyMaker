import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig, LandingPage } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");
export const SITES_DIR = path.join(DATA_DIR, "sites");
export const SENT_DIR = path.join(DATA_DIR, "sent");
export const RUNS_FILE = path.join(DATA_DIR, "runs.json");
export const CONFIG_FILE = path.join(DATA_DIR, "config.json");

async function ensureDirs() {
  await fs.mkdir(SITES_DIR, { recursive: true });
  await fs.mkdir(SENT_DIR, { recursive: true });
}

export async function saveSiteHtml(id: string, html: string): Promise<string> {
  await ensureDirs();
  const file = path.join(SITES_DIR, `${id}.html`);
  await fs.writeFile(file, html, "utf8");
  return path.relative(process.cwd(), file);
}

export async function loadSiteHtml(id: string): Promise<string | null> {
  const file = path.join(SITES_DIR, `${id}.html`);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

export async function saveRun(id: string, pages: LandingPage[]) {
  await ensureDirs();
  let runs: Record<string, LandingPage[]> = {};
  try {
    runs = JSON.parse(await fs.readFile(RUNS_FILE, "utf8"));
  } catch {}
  runs[id] = pages;
  await fs.writeFile(RUNS_FILE, JSON.stringify(runs, null, 2), "utf8");
}

export async function loadRun(id: string): Promise<LandingPage[] | null> {
  try {
    const runs = JSON.parse(await fs.readFile(RUNS_FILE, "utf8"));
    return runs[id] ?? null;
  } catch {
    return null;
  }
}

const DEFAULT_CONFIG: AppConfig = {
  price: 499,
  paymentDetails: process.env.PAYMENT_DETAILS ?? "Paypal: you@example.com",
  fromName: "Alex the Freelancer",
  fromEmail: process.env.SMTP_FROM?.match(/<(.+)>/)?.[1] ?? "you@example.com",
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const c = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
    return { ...DEFAULT_CONFIG, ...c };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(c: Partial<AppConfig>): Promise<AppConfig> {
  await ensureDirs();
  const merged = { ...(await loadConfig()), ...c };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
