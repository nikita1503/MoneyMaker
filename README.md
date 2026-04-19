# MoneyMaker

![MoneyMaker in action](./final_launch.gif)

## We built an agent that makes money while you sleep. During the event alone, it generated **Rs. 5,000**.

**Live proof:** [primus-construction.flames.app](https://primus-construction.flames.app/) — a website our agent generated and sold to a builder from a tier-2 city who had a LinkedIn and Instagram presence but no website of his own.

---

## The idea

The core insight is simple: your sales conversion goes up significantly when you deliver a real product instead of just pitching an idea the client is already planning to build. Imagine a Shopify seller instantly receiving a launch video for their product, or a founder who raised pre-seed yesterday getting a beautifully personalized website today based on publicly available details.

The challenge is scale. Creating custom deliverables like websites or launch videos for every prospect is expensive and operationally impractical.

That is where Crustdata comes in. It helps us identify the highest-quality prospects so we can focus automation where it matters most.

For this demo, we built a dashboard that filters for businesses with strong revenue potential but no website. Using web, person, and company APIs, the system automatically generates a highly personalized website for each lead and then reaches out to sell it. Over time, this can expand beyond websites into other productized outputs, such as AI-generated launch videos with tools like Higgsfield.

> Find companies that need a better website → build one with Claude Opus 4.7 →
> send them a screenshot pitch → get paid.

End-to-end pipeline built on **Crustdata** (company + people data) and
**Claude Opus 4.7** (landing-page planning + HTML rendering).

---

## What it does

1. **Start search** — calls Crustdata `/screener/company/search` with the
   heuristics in `lib/heuristics.ts` (`STEP1_FILTERS`).
2. **Rank** — scores every returned company with `scoreCompany()` and keeps
   the top N (`TOP_N`).
3. **Generate** — for each selected prospect, in parallel:
   - enriches via `/screener/company`
   - calls Claude Opus 4.7 to produce a **Markdown landing-page plan**
     (audience, narrative, sections, visual style, voice)
   - calls Claude Opus 4.7 again to render the plan into a **full HTML document**
   - saves to `data/sites/<id>.html`
4. **Preview** — each page is browsable in an iframe and viewable full-screen.
5. **Send** — for each selected page, in parallel:
   - finds the founder / top contact via Crustdata people search
   - takes a full-page screenshot with Puppeteer
   - builds a freelance-pitch email (price + payment details from config)
   - sends via SMTP if configured, else saves an `.eml` to `data/sent/` you
     can drag into any mail client.

---

## Required environment

| Variable             | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `CRUSTDATA_API_KEY`  | Crustdata company + people API                                  |
| `ANTHROPIC_API_KEY`  | Claude Opus 4.7 landing-page generation                         |
