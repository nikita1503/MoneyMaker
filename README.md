# MoneyMaker

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

## Quick start

```bash
cd MoneyMaker
npm install
cp .env.local.example .env.local  # then fill in keys
npm run dev
open http://localhost:3737
```

## Required environment

| Variable             | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `CRUSTDATA_API_KEY`  | Crustdata company + people API                                  |
| `ANTHROPIC_API_KEY`  | Claude Opus 4.7 landing-page generation                         |

## Optional environment (SMTP)

Leaving these blank is fine — the `/send` step will instead serialize emails
to `.eml` files in `data/sent/` that you can open with Apple Mail / Outlook /
Gmail drag-and-drop.

| Variable         | Example                              |
| ---------------- | ------------------------------------ |
| `SMTP_HOST`      | `smtp.gmail.com`                     |
| `SMTP_PORT`      | `587`                                |
| `SMTP_USER`      | `you@gmail.com`                      |
| `SMTP_PASS`      | app-specific password                |
| `SMTP_FROM`      | `"Alex <alex@gmail.com>"`            |
| `DEV_MODE_EMAIL` | `you@gmail.com` — redirects all outbound mail here (blank = off) |
| `PAYMENT_DETAILS`| `Paypal: alex@gmail.com`             |

### Dev mode

Set `DEV_MODE_EMAIL` in `.env.local` to any inbox you control. While it's set,
every `/api/send` call — regardless of whether SMTP is configured — delivers
to that address instead of the real prospect. The real intended recipient is
prefixed into the subject line (`[DEV MODE — would have sent to jane@acme.com] …`)
and the UI shows a `dev → your@inbox` chip on each result row. Clear the
variable and restart `npm run dev` to go live.

Runtime config (price, freelancer name/email, payment details) is editable
from the ⚙︎ **Config** drawer in the UI and persisted to `data/config.json`.

---

## Where to change behavior

| Want to change…                          | Edit                                   |
| ---------------------------------------- | -------------------------------------- |
| Who Crustdata returns                    | `STEP1_FILTERS` in `lib/heuristics.ts` |
| How prospects are ranked                 | `scoreCompany()` in `lib/heuristics.ts`|
| Top-N cutoff                             | `TOP_N` in `lib/heuristics.ts`         |
| The plan prompt (MD structure, voice)    | `planLandingPage()` in `lib/claude.ts` |
| The HTML render prompt                   | `renderLandingHtml()` in `lib/claude.ts`|
| Outreach email copy                      | `buildEmail()` in `app/api/send/route.ts` |

---

## Routes

| Method | Path                    | Purpose                                     |
| ------ | ----------------------- | ------------------------------------------- |
| `POST` | `/api/search`           | Run search + rank; returns `ranked[]`       |
| `POST` | `/api/generate`         | Generate HTML for `companies[]` in parallel |
| `POST` | `/api/send`             | Screenshot + email for `pages[]` in parallel|
| `GET`  | `/api/preview/:id`      | Serve saved HTML for a prospect             |
| `GET`  | `/api/config`           | Read runtime config                         |
| `POST` | `/api/config`           | Persist runtime config                      |

---

## File layout

```
MoneyMaker/
├── app/                       # Next.js 14 app router
│   ├── page.tsx               # Dashboard UI
│   ├── api/                   # Route handlers
│   └── globals.css
├── components/
│   ├── CompanyCard.tsx
│   └── PagePreview.tsx
├── lib/
│   ├── crustdata.ts           # search / enrich / people
│   ├── claude.ts              # planLandingPage + renderLandingHtml
│   ├── heuristics.ts          # filters + ranking — tweak me
│   ├── screenshot.ts          # puppeteer full-page PNG
│   ├── email.ts               # nodemailer (SMTP or .eml fallback)
│   ├── storage.ts             # data/ file persistence
│   └── types.ts
└── data/                      # gitignored — generated artefacts
    ├── sites/<id>.html        # generated landing pages
    ├── sent/*.eml             # offline outreach drafts
    ├── runs.json              # run history
    └── config.json            # persisted runtime config
```
