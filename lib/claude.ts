import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-7";

let _client: Anthropic | null = null;
function client() {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set in .env.local");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export async function planLandingPage(companyData: unknown): Promise<string> {
  const sys = `You are a senior product designer and copywriter. Given raw data about a company,
produce a concrete plan for a one-page marketing/landing site the company could actually ship.

Output strictly Markdown with these sections, in order:

## Audience
Who the target customers are and the jobs-to-be-done.

## Narrative
The story the site should tell, in 3–5 sentences. Include the promise, the villain/status-quo,
and the resolution. Avoid generic SaaS platitudes.

## Sections
Numbered list. For each section:
- **Name** (hero, features, social proof, pricing, CTA, etc.)
- **Purpose** (one line)
- **Copy** (headline + 1–2 supporting lines, written ready-to-use)
- **Elements** (what visually goes on it — photos, icons, graphs, a logo strip, etc.)

## Visual Style
Specify:
- Primary color (hex)
- Accent color (hex)
- Neutral background (hex)
- Typography (heading + body fonts, pick real Google Fonts)
- Overall mood (one sentence)

## Brand Voice
2–3 adjectives and a "do" / "don't" list.`;

  const user = `Company data (JSON):\n\n\`\`\`json\n${JSON.stringify(companyData, null, 2).slice(0, 40000)}\n\`\`\`\n\nWrite the plan now.`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  return textOf(res);
}

export async function renderLandingHtml(planMd: string, companyName: string): Promise<string> {
  const sys = `You are an expert frontend engineer. Given a landing-page plan in Markdown,
produce a complete, production-ready single-file HTML document.

Hard requirements:
- Return ONLY the HTML (no markdown code fences, no commentary).
- Full <!doctype html> document with <html>, <head>, <body>.
- All CSS inline in a single <style> tag. No external CSS files.
- Use the Google Fonts specified in the plan via a <link> tag.
- Responsive (mobile-first). Looks excellent at 1440 and 390 px widths.
- Semantic HTML. Accessible contrast.
- Use real, concrete copy from the plan — never lorem ipsum.
- Use inline SVG for icons and simple illustrations. No <img> tags pointing to external URLs.
- Include every section listed in the plan.
- Add subtle hover states and transitions.
- Keep JS to an absolute minimum; only if it adds clear value (e.g. mobile menu).
- Target: feels like a site a well-funded startup could ship tomorrow.`;

  const user = `Company: ${companyName}\n\nPlan:\n\n${planMd}\n\nReturn the full HTML document now.`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  const raw = textOf(res).trim();
  // Defensive strip in case the model still wraps in fences.
  return raw.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
}

function textOf(res: Anthropic.Message): string {
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
