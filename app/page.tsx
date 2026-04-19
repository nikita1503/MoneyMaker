"use client";
import { useEffect, useState } from "react";
import { CompanyCard } from "@/components/CompanyCard";
import { PagePreview } from "@/components/PagePreview";
import type { AppConfig, LandingPage, OutreachResult, RankedCompany } from "@/lib/types";

type Step = "idle" | "searching" | "ranked" | "generating" | "generated" | "sending" | "sent";

const STEP_META = [
  { idx: 1, key: "search", label: "Search" },
  { idx: 2, key: "pick", label: "Pick" },
  { idx: 3, key: "build", label: "Review" },
  { idx: 4, key: "send", label: "Send" },
] as const;

function stepIndex(step: Step): 1 | 2 | 3 | 4 {
  if (step === "idle" || step === "searching") return 1;
  if (step === "ranked" || step === "generating") return 2;
  if (step === "generated" || step === "sending") return 3;
  return 4;
}

export default function Dashboard() {
  const [step, setStep] = useState<Step>("idle");
  const [ranked, setRanked] = useState<RankedCompany[]>([]);
  const [pickedForGen, setPickedForGen] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [pickedForSend, setPickedForSend] = useState<Set<string>>(new Set());
  const [sendResults, setSendResults] = useState<OutreachResult[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const say = (m: string) =>
    setLog((l) => [...l.slice(-30), `${new Date().toLocaleTimeString()} — ${m}`]);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig);
  }, []);

  // Global Esc to close overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (configOpen) setConfigOpen(false);
      else if (logOpen) setLogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [configOpen, logOpen]);

  async function startSearch() {
    setStep("searching");
    setPages([]);
    setSendResults([]);
    setPickedForGen(new Set());
    setPickedForSend(new Set());
    say("searching Crustdata…");
    try {
      const r = await fetch("/api/search", { method: "POST", body: "{}" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setRanked(data.ranked);
      say(`ranked ${data.ranked.length} of ${data.totalFound} companies`);
      setStep("ranked");
      setPickedForGen(new Set(data.ranked.slice(0, 4).map((c: RankedCompany) => c.id)));
    } catch (e: any) {
      say(`error: ${e.message}`);
      setStep("idle");
    }
  }

  async function generate() {
    const chosen = ranked.filter((c) => pickedForGen.has(c.id));
    if (!chosen.length) return;
    setStep("generating");
    say(`generating ${chosen.length} landing pages in parallel…`);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: chosen }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPages(data.pages);
      setPickedForSend(
        new Set(data.pages.filter((p: LandingPage) => !p.error).map((p: LandingPage) => p.id))
      );
      const ok = data.pages.filter((p: LandingPage) => !p.error).length;
      say(`generated ${ok}/${data.pages.length} pages`);
      setStep("generated");
    } catch (e: any) {
      say(`error: ${e.message}`);
      setStep("ranked");
    }
  }

  async function send() {
    const chosen = pages.filter((p) => pickedForSend.has(p.id) && !p.error);
    if (!chosen.length) return;
    setStep("sending");
    say(`sending ${chosen.length} emails…`);
    try {
      const r = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: chosen }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSendResults(data.results);
      const sent = data.results.filter((x: OutreachResult) => x.sent).length;
      const drafted = data.results.filter((x: OutreachResult) => x.savedEml).length;
      say(
        `${sent} sent · ${drafted} drafted locally · ${
          data.results.length - sent - drafted
        } errored`
      );
      setStep("sent");
    } catch (e: any) {
      say(`error: ${e.message}`);
      setStep("generated");
    }
  }

  function startOver() {
    setRanked([]);
    setPages([]);
    setSendResults([]);
    setPickedForGen(new Set());
    setPickedForSend(new Set());
    setStep("idle");
  }

  function toggle(set: Set<string>, id: string, update: (s: Set<string>) => void) {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    update(n);
  }

  // Stepper navigation — only allowed for steps with data.
  function goToStep(target: 1 | 2 | 3) {
    if (target === 1) setStep("idle");
    else if (target === 2 && ranked.length) setStep("ranked");
    else if (target === 3 && pages.length) setStep("generated");
  }

  const currentIdx = stepIndex(step);
  const doneFlags = {
    1: ranked.length > 0,
    2: pages.length > 0,
    3: sendResults.length > 0,
    4: step === "sent",
  };

  return (
    <main className="mx-auto max-w-6xl px-5 md:px-8 py-8 md:py-10">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Money
            <span className="bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent">
              Maker
            </span>
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1">
            Find companies that need websites → build them → sell them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setLogOpen(true)}>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 mr-0.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            </span>
            Activity
            {log.length > 0 && (
              <span className="chip !py-0 !px-1.5 ml-1">{log.length}</span>
            )}
          </button>
          <button className="btn" onClick={() => setConfigOpen(true)}>
            <span className="text-base leading-none">⚙︎</span> Config
          </button>
        </div>
      </header>

      {/* Stepper */}
      <Stepper current={currentIdx} done={doneFlags} onJump={goToStep} />

      {/* Wizard body — exactly one step in DOM */}
      <section className="mt-8">
        <div key={step} className="step-enter">
          {(step === "idle") && (
            <StepSearch onStart={startSearch} />
          )}

          {step === "searching" && (
            <LoadingSearch />
          )}

          {step === "ranked" && (
            <StepRanked
              ranked={ranked}
              picked={pickedForGen}
              onToggle={(id) => toggle(pickedForGen, id, setPickedForGen)}
              onBack={() => setStep("idle")}
              onNext={generate}
            />
          )}

          {step === "generating" && (
            <LoadingGenerate count={pickedForGen.size} />
          )}

          {step === "generated" && (
            <StepGenerated
              pages={pages}
              picked={pickedForSend}
              onToggle={(id) => toggle(pickedForSend, id, setPickedForSend)}
              onBack={() => setStep("ranked")}
              onNext={send}
            />
          )}

          {step === "sending" && (
            <LoadingSend count={pickedForSend.size} />
          )}

          {step === "sent" && (
            <StepSent results={sendResults} onStartOver={startOver} />
          )}
        </div>
      </section>

      {/* Config modal */}
      {configOpen && config && (
        <>
          <div className="overlay" onClick={() => setConfigOpen(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label="Configuration">
            <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Configuration</h3>
                  <p className="text-xs text-muted mt-0.5">
                    These values are baked into the outreach email.
                  </p>
                </div>
                <button className="btn btn-ghost" onClick={() => setConfigOpen(false)}>Close</button>
              </div>
              <ConfigPanel
                config={config}
                onSave={(c) => {
                  setConfig(c);
                  setConfigOpen(false);
                  say("config saved");
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Activity log drawer */}
      {logOpen && (
        <>
          <div className="overlay" onClick={() => setLogOpen(false)} />
          <aside className="drawer" aria-label="Activity log">
            <div className="flex items-center justify-between p-4 border-b border-line">
              <div>
                <div className="text-sm font-semibold">Activity log</div>
                <div className="text-[11px] text-muted">Most recent events</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setLogOpen(false)}>Close</button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11.5px] leading-6 text-white/75 whitespace-pre-wrap font-mono">
{log.length ? log.slice().reverse().join("\n") : "No activity yet."}
            </pre>
          </aside>
        </>
      )}

      <footer className="mt-12 text-center text-[11px] text-muted">
        Crustdata + Claude Opus 4.7 · Tune heuristics in <code>lib/heuristics.ts</code>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

function Stepper({
  current,
  done,
  onJump,
}: {
  current: 1 | 2 | 3 | 4;
  done: Record<1 | 2 | 3 | 4, boolean>;
  onJump: (target: 1 | 2 | 3) => void;
}) {
  return (
    <div className="mt-6 md:mt-8">
      {/* Desktop: full stepper */}
      <div className="hidden sm:flex items-center">
        {STEP_META.map((s, i) => {
          const idx = s.idx as 1 | 2 | 3 | 4;
          const state =
            idx < current ? "done" : idx === current ? "current" : "future";
          const clickable = state === "done" && idx !== 4;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onJump(idx as 1 | 2 | 3)}
                  className={`stepper-node stepper-node--${state} ${
                    clickable ? "stepper-node--clickable" : ""
                  }`}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={`${s.label} — ${state}`}
                >
                  {state === "done" ? "✓" : s.idx}
                </button>
                <div
                  className={`mt-2 text-[11px] tracking-wide uppercase ${
                    state === "future" ? "text-muted" : "text-white/80"
                  }`}
                >
                  {s.label}
                </div>
              </div>
              {i < STEP_META.length - 1 && (
                <div
                  className={`stepper-line ${
                    done[idx] || idx < current ? "stepper-line--done" : "stepper-line--future"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Mobile: compact label */}
      <div className="sm:hidden flex items-center justify-between gap-3 card px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">
            Step {current} of 4
          </div>
          <div className="font-semibold">{STEP_META[current - 1].label}</div>
        </div>
        <div className="flex gap-1">
          {STEP_META.map((s) => {
            const idx = s.idx as 1 | 2 | 3 | 4;
            const state = idx < current ? "done" : idx === current ? "current" : "future";
            return (
              <span
                key={s.key}
                className={`h-1.5 w-6 rounded-full ${
                  state === "current"
                    ? "bg-gradient-to-r from-accent to-accent2"
                    : state === "done"
                    ? "bg-accent"
                    : "bg-line"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Search                                                     */
/* ------------------------------------------------------------------ */

function StepSearch({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-2xl text-center py-6 md:py-12">
      <div className="inline-flex items-center gap-2 chip mb-5">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Step 1 · Prospecting
      </div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
        Find companies that could use a better website.
      </h2>
      <p className="mt-4 text-muted text-sm md:text-base leading-relaxed">
        We query Crustdata with your heuristics, score every company, and surface the top
        candidates. You stay in control of what happens next.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          Start search →
        </button>
        <div className="text-[11px] text-muted">
          Edit filters in <code className="text-white/70">lib/heuristics.ts</code>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
        {[
          { t: "Search", d: "Crustdata API + custom heuristics." },
          { t: "Build", d: "Claude Opus 4.7 generates landing pages." },
          { t: "Send", d: "Personalized outreach emails, drafted or sent." },
        ].map((x) => (
          <div key={x.t} className="card p-4">
            <div className="text-xs uppercase tracking-wider text-accent">{x.t}</div>
            <div className="mt-1 text-sm text-white/80">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Ranked                                                     */
/* ------------------------------------------------------------------ */

function StepRanked({
  ranked,
  picked,
  onToggle,
  onBack,
  onNext,
}: {
  ranked: RankedCompany[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <StickyActionBar
        title={`Top ${ranked.length} prospects`}
        subtitle="Select which companies to generate landing pages for."
        onBack={onBack}
        backLabel="Back to search"
        primary={
          <button
            className="btn btn-primary"
            onClick={onNext}
            disabled={picked.size === 0}
          >
            Generate {picked.size} website{picked.size === 1 ? "" : "s"} →
          </button>
        }
      />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ranked.map((c) => (
          <CompanyCard
            key={c.id}
            c={c}
            selected={picked.has(c.id)}
            onToggle={() => onToggle(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Generated                                                  */
/* ------------------------------------------------------------------ */

function StepGenerated({
  pages,
  picked,
  onToggle,
  onBack,
  onNext,
}: {
  pages: LandingPage[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const okCount = pages.filter((p) => !p.error).length;
  return (
    <div>
      <StickyActionBar
        title={`${okCount} landing pages ready`}
        subtitle="Review each page, then pick which to pitch."
        onBack={onBack}
        backLabel="Back to prospects"
        primary={
          <button
            className="btn btn-primary"
            onClick={onNext}
            disabled={picked.size === 0}
          >
            Send {picked.size} email{picked.size === 1 ? "" : "s"} →
          </button>
        }
      />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map((p) => (
          <PagePreview
            key={p.id}
            page={p}
            selected={picked.has(p.id)}
            onToggle={() => onToggle(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Sent                                                       */
/* ------------------------------------------------------------------ */

function StepSent({
  results,
  onStartOver,
}: {
  results: OutreachResult[];
  onStartOver: () => void;
}) {
  const sent = results.filter((r) => r.sent).length;
  const drafted = results.filter((r) => r.savedEml).length;
  const errored = results.filter((r) => r.error).length;

  return (
    <div>
      <div className="card p-6 md:p-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-accent to-accent2 text-white text-2xl mb-4 shadow-glow">
          ✓
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
          Outreach complete
        </h2>
        <p className="text-muted text-sm mt-1">
          {results.length} campaign{results.length === 1 ? "" : "s"} processed.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
          <Stat n={sent} label="Sent" tone="success" />
          <Stat n={drafted} label="Drafted" tone="warn" />
          <Stat n={errored} label="Errored" tone="danger" />
        </div>

        <div className="mt-6 flex justify-center">
          <button className="btn btn-primary btn-lg" onClick={onStartOver}>
            Start over
          </button>
        </div>
      </div>

      <div className="mt-6 card">
        <div className="px-5 py-3 border-b border-line text-[11px] uppercase tracking-wider text-muted">
          Per-recipient results
        </div>
        <ul className="divide-y divide-line">
          {results.map((r) => (
            <li key={r.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">{r.companyName}</div>
                <div className="text-xs text-muted mt-0.5">
                  {r.recipient?.name
                    ? `${r.recipient.name} · ${r.recipient.title ?? ""}`
                    : "(no contact)"}{" "}
                  {r.recipient?.email ? `· ${r.recipient.email}` : ""}
                </div>
                {r.subject && (
                  <div className="text-xs mt-1 italic text-white/70">“{r.subject}”</div>
                )}
              </div>
              <div className="text-right text-xs whitespace-nowrap flex flex-col items-end gap-1 shrink-0">
                {r.sent && <span className="chip chip-success">sent</span>}
                {r.redirectedTo && (
                  <span className="chip chip-info">dev → {r.redirectedTo}</span>
                )}
                {r.savedEml && (
                  <span className="chip chip-warn">drafted</span>
                )}
                {r.error && <span className="chip chip-danger">{r.error}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: "success" | "warn" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-rose-300";
  return (
    <div className="rounded-lg border border-line bg-ink/40 py-3">
      <div className={`text-2xl font-bold ${color}`}>{n}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted mt-0.5">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading states                                                      */
/* ------------------------------------------------------------------ */

function LoadingSearch() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="spinner" />
        <div>
          <div className="font-semibold">Searching Crustdata…</div>
          <div className="text-xs text-muted">Scoring candidates against your heuristics.</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/2 mt-3" />
            <div className="mt-5 flex gap-2">
              <div className="skeleton h-5 w-14" />
              <div className="skeleton h-5 w-12" />
              <div className="skeleton h-5 w-16" />
            </div>
            <div className="skeleton h-3 w-full mt-5" />
            <div className="skeleton h-3 w-5/6 mt-2" />
            <div className="skeleton h-3 w-4/6 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingGenerate({ count }: { count: number }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="spinner" />
        <div>
          <div className="font-semibold">
            Generating {count} landing page{count === 1 ? "" : "s"}…
          </div>
          <div className="text-xs text-muted">
            Claude Opus 4.7 is writing HTML in parallel — this takes ~30 seconds.
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: Math.max(count, 3) }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="p-3.5 border-b border-line flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 rounded-md" />
              <div className="flex-1">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-2.5 w-1/2 mt-2" />
              </div>
            </div>
            <div className="skeleton" style={{ aspectRatio: "16/10", borderRadius: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSend({ count }: { count: number }) {
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div className="spinner" />
      <div className="mt-4 font-semibold text-lg">
        Sending {count} email{count === 1 ? "" : "s"}…
      </div>
      <div className="text-xs text-muted mt-1">
        Attaching screenshots and personalizing copy.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function StickyActionBar({
  title,
  subtitle,
  onBack,
  backLabel,
  primary,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel: string;
  primary: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-5 md:-mx-8 px-5 md:px-8 py-3.5
                    bg-ink/70 backdrop-blur border-b border-line">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="text-white/70 hover:text-white transition"
            >
              ← {backLabel}
            </button>
          </div>
          <div className="font-semibold truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted truncate">{subtitle}</div>}
        </div>
        <div className="shrink-0">{primary}</div>
      </div>
    </div>
  );
}

function ConfigPanel({
  config,
  onSave,
}: {
  config: AppConfig;
  onSave: (c: AppConfig) => void;
}) {
  const [price, setPrice] = useState(config.price);
  const [paymentDetails, setPaymentDetails] = useState(config.paymentDetails);
  const [fromName, setFromName] = useState(config.fromName);
  const [fromEmail, setFromEmail] = useState(config.fromEmail);

  async function save() {
    const r = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: Number(price), paymentDetails, fromName, fromEmail }),
    });
    const c = await r.json();
    onSave(c);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="lbl">Price offered (USD)</label>
        <input
          className="field"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="lbl">Payment details</label>
        <input
          className="field"
          value={paymentDetails}
          onChange={(e) => setPaymentDetails(e.target.value)}
        />
      </div>
      <div>
        <label className="lbl">Your name (freelancer)</label>
        <input className="field" value={fromName} onChange={(e) => setFromName(e.target.value)} />
      </div>
      <div>
        <label className="lbl">Your email (from address)</label>
        <input className="field" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
