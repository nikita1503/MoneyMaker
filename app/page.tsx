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

  function goToStep(target: 1 | 2 | 3) {
    if (target === 1) setStep("idle");
    else if (target === 2 && ranked.length) setStep("ranked");
    else if (target === 3 && pages.length) setStep("generated");
  }

  const currentIdx = stepIndex(step);

  return (
    <main className="mx-auto max-w-5xl px-5 md:px-8 py-8 md:py-12">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <h1 className="font-display font-bold text-[34px] md:text-[40px] leading-none text-ink">
              Money<span className="text-accent">Maker</span>
            </h1>
            <p className="mt-1 text-[15px] text-ink/75">
              Find companies that need websites. Build 'em. Sell 'em.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={() => setLogOpen(true)}>
            <span className="inline-block h-2 w-2 rounded-full bg-success mr-1" />
            Log {log.length > 0 && <span className="opacity-70">({log.length})</span>}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => setConfigOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      {/* Stepper */}
      <Stepper current={currentIdx} onJump={goToStep} />

      {/* Wizard body */}
      <section className="mt-10">
        <div key={step} className="step-enter">
          {step === "idle" && <StepSearch onStart={startSearch} />}
          {step === "searching" && <LoadingSearch />}
          {step === "ranked" && (
            <StepRanked
              ranked={ranked}
              picked={pickedForGen}
              onToggle={(id) => toggle(pickedForGen, id, setPickedForGen)}
              onBack={() => setStep("idle")}
              onNext={generate}
            />
          )}
          {step === "generating" && <LoadingGenerate count={pickedForGen.size} />}
          {step === "generated" && (
            <StepGenerated
              pages={pages}
              picked={pickedForSend}
              onToggle={(id) => toggle(pickedForSend, id, setPickedForSend)}
              onBack={() => setStep("ranked")}
              onNext={send}
            />
          )}
          {step === "sending" && <LoadingSend count={pickedForSend.size} />}
          {step === "sent" && <StepSent results={sendResults} onStartOver={startOver} />}
        </div>
      </section>

      {/* Config modal */}
      {configOpen && config && (
        <>
          <div className="overlay" onClick={() => setConfigOpen(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
            <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <span className="tag">settings</span>
                  <h3 className="font-display font-bold text-[28px] mt-3 leading-tight">
                    Tune the pitch
                  </h3>
                  <p className="text-ink/70 text-[15px] mt-1">
                    These values are baked into every outreach email.
                  </p>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => setConfigOpen(false)}>
                  close
                </button>
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

      {/* Activity drawer */}
      {logOpen && (
        <>
          <div className="overlay" onClick={() => setLogOpen(false)} />
          <aside className="drawer" aria-label="Activity log">
            <div className="flex items-center justify-between p-5 border-b-2 border-dashed border-ink/30">
              <div>
                <span className="tag">log</span>
                <div className="font-display font-bold text-[22px] mt-2">Scribbles</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setLogOpen(false)}>
                close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {log.length ? (
                <ul className="space-y-3">
                  {log.slice().reverse().map((line, i) => (
                    <li key={i} className="flex gap-2 text-[15px] leading-snug">
                      <span className="text-accent shrink-0">›</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-ink/50 italic">nothing to see yet…</div>
              )}
            </div>
          </aside>
        </>
      )}

      <footer className="mt-16 text-center text-[14px] text-ink/60">
        Scribbled with Crustdata + Claude Opus 4.7 ·
        {" "}tune heuristics in <code>lib/heuristics.ts</code>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Small decorative pieces                                              */
/* ------------------------------------------------------------------ */

function LogoMark() {
  return (
    <div
      className="relative h-14 w-14 shrink-0 bg-sticky border-[3px] border-ink flex items-center justify-center font-display font-bold text-[22px] text-ink"
      style={{
        borderRadius: "48% 52% 46% 54% / 54% 48% 52% 46%",
        boxShadow: "4px 4px 0 0 #2d2d2d",
        transform: "rotate(-4deg)",
      }}
      aria-hidden
    >
      $
      <span
        className="absolute -top-2 -right-2 h-4 w-4 bg-accent border-2 border-ink rounded-full"
        style={{ boxShadow: "2px 2px 0 0 #2d2d2d" }}
      />
    </div>
  );
}

function HandArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 90"
      className={className}
      aria-hidden
      fill="none"
      stroke="#2d2d2d"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path
        d="M8 14 C 36 12, 50 34, 58 54 C 66 74, 82 78, 112 72"
        strokeDasharray="5 5"
      />
      <path d="M112 72 L 102 64" />
      <path d="M112 72 L 104 82" />
      <text
        x="10"
        y="36"
        fill="#2d2d2d"
        stroke="none"
        fontFamily="var(--font-kalam), cursive"
        fontWeight="700"
        fontSize="15"
        transform="rotate(-12, 10, 36)"
      >
        click me!
      </text>
    </svg>
  );
}

function SquiggleDivider() {
  return (
    <svg viewBox="0 0 320 12" className="w-40 h-3" aria-hidden fill="none">
      <path
        d="M2 6 Q 20 1, 40 6 T 80 6 T 120 6 T 160 6 T 200 6 T 240 6 T 280 6 T 318 6"
        stroke="#2d2d2d"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                              */
/* ------------------------------------------------------------------ */

function Stepper({
  current,
  onJump,
}: {
  current: 1 | 2 | 3 | 4;
  onJump: (target: 1 | 2 | 3) => void;
}) {
  return (
    <div className="mt-10 md:mt-14">
      {/* Desktop */}
      <div className="hidden sm:flex items-start">
        {STEP_META.map((s, i) => {
          const idx = s.idx as 1 | 2 | 3 | 4;
          const state = idx < current ? "done" : idx === current ? "current" : "future";
          const clickable = state === "done" && idx !== 4;
          return (
            <div key={s.key} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onJump(idx as 1 | 2 | 3)}
                  className={`step-node step-node--${state} ${
                    clickable ? "step-node--clickable" : ""
                  }`}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={`${s.label} — ${state}`}
                >
                  {state === "done" ? "✓" : s.idx}
                </button>
                <div
                  className={`mt-3 step-label ${state === "future" ? "step-label--future" : ""}`}
                >
                  {s.label}
                </div>
              </div>
              {i < STEP_META.length - 1 && (
                <div
                  className={`step-dash ${
                    idx < current ? "" : "step-dash--future"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Mobile */}
      <div className="sm:hidden card p-4 flex items-center justify-between gap-3" style={{ transform: "rotate(-0.6deg)" }}>
        <div>
          <div className="font-display font-bold text-[13px] text-ink/60 tracking-wide uppercase">
            Step {current} of 4
          </div>
          <div className="font-display font-bold text-[22px] mt-0.5 leading-tight">
            {STEP_META[current - 1].label}
          </div>
        </div>
        <div className="flex gap-1">
          {STEP_META.map((s) => {
            const idx = s.idx as 1 | 2 | 3 | 4;
            const state = idx < current ? "done" : idx === current ? "current" : "future";
            return (
              <span
                key={s.key}
                className="h-2 w-6"
                style={{
                  backgroundColor:
                    state === "current" ? "#ff4d4d" : state === "done" ? "#2d2d2d" : "#e5e0d8",
                  border: "1px solid #2d2d2d",
                  borderRadius: "8px 3px 8px 3px / 3px 8px 3px 8px",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Search                                                      */
/* ------------------------------------------------------------------ */

function StepSearch({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative mx-auto max-w-3xl text-center py-4 md:py-8">
      <span className="tag">01 · prospecting</span>

      <h2 className="font-display font-bold text-[44px] md:text-[60px] leading-[1.02] mt-6">
        Find businesses that
        <br />
        need{" "}
        <span className="underline-doodle text-accent">a better</span>{" "}
        website
        <span className="inline-block ml-1 text-accent animate-bang-spin" style={{ transformOrigin: "50% 80%" }}>
          !
        </span>
      </h2>

      <p className="mt-6 text-[18px] md:text-[20px] text-ink/80 max-w-2xl mx-auto leading-relaxed">
        We scour Crustdata with your heuristics, scribble a score on every company, and
        hand you the pick of the litter. You stay the boss.
      </p>

      <div className="mt-10 inline-flex flex-col items-center relative">
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          Start search →
        </button>
        <HandArrow className="hidden md:block absolute -left-36 -top-3 w-36 h-24 -rotate-6" />
        <div className="mt-4 text-[14px] text-ink/55">
          heuristics live in <code>lib/heuristics.ts</code>
        </div>
      </div>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { n: "01", t: "Search", d: "Crustdata + your hand-tuned heuristics." },
          { n: "02", t: "Build", d: "Claude Opus 4.7 sketches each landing page." },
          { n: "03", t: "Send", d: "Personal outreach emails with preview attached." },
        ].map((x, i) => (
          <div
            key={x.t}
            className={`card card-sticky p-6 relative ${
              i === 1 ? "md:translate-y-3 md:rotate-1" : i === 0 ? "md:-rotate-2" : "md:rotate-2"
            }`}
          >
            <span className="tape" />
            <div className="font-display font-bold text-accent text-[28px]">{x.n}</div>
            <div className="font-display font-bold text-[22px] mt-1">{x.t}</div>
            <div className="mt-2 text-[16px] text-ink/80 leading-snug">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Ranked                                                      */
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
      <ActionBar
        eyebrow="02 · pick"
        title={`${ranked.length} prospects on the board`}
        subtitle="Circle the ones you'd like to pitch. We'll build them landing pages next."
        backLabel="back to search"
        onBack={onBack}
        primary={
          <button className="btn btn-accent" onClick={onNext} disabled={picked.size === 0}>
            Build {picked.size} page{picked.size === 1 ? "" : "s"} →
          </button>
        }
      />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ranked.map((c, i) => (
          <div
            key={c.id}
            style={{ transform: `rotate(${(i % 3 - 1) * 0.6}deg)` }}
            className="transition-transform hover:!rotate-0"
          >
            <CompanyCard
              c={c}
              selected={picked.has(c.id)}
              onToggle={() => onToggle(c.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Generated                                                   */
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
      <ActionBar
        eyebrow="03 · review"
        title={`${okCount} pages wet with ink`}
        subtitle="Eyeball each one. Uncheck any that look off before we send them."
        backLabel="back to picks"
        onBack={onBack}
        primary={
          <button className="btn btn-accent" onClick={onNext} disabled={picked.size === 0}>
            Send {picked.size} email{picked.size === 1 ? "" : "s"} →
          </button>
        }
      />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pages.map((p, i) => (
          <div
            key={p.id}
            style={{ transform: `rotate(${((i % 3) - 1) * 0.5}deg)` }}
            className="transition-transform hover:!rotate-0"
          >
            <PagePreview
              page={p}
              selected={picked.has(p.id)}
              onToggle={() => onToggle(p.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Sent                                                        */
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
      <div className="card p-8 md:p-10 text-center relative" style={{ transform: "rotate(-0.4deg)" }}>
        <span className="thumbtack" />
        <span className="tag">04 · sent</span>
        <h2 className="font-display font-bold text-[40px] md:text-[52px] mt-4 leading-tight">
          That's a wrap<span className="text-accent">!</span>
        </h2>
        <p className="text-ink/75 text-[17px] mt-2">
          {results.length} campaign{results.length === 1 ? "" : "s"} pushed down the pipe.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
          <Stat n={sent} label="sent" tone="success" rot={-2} />
          <Stat n={drafted} label="drafted" tone="warn" rot={1.5} />
          <Stat n={errored} label="errored" tone="danger" rot={-1} />
        </div>

        <div className="mt-8 flex justify-center">
          <button className="btn btn-primary btn-lg" onClick={onStartOver}>
            Start a new batch →
          </button>
        </div>
      </div>

      <div className="mt-8 card p-0">
        <div className="px-6 py-4 border-b-2 border-dashed border-ink/25 flex items-center justify-between">
          <span className="tag">per recipient</span>
        </div>
        <ul className="divide-y-2 divide-dashed divide-ink/15">
          {results.map((r) => (
            <li key={r.id} className="px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display font-bold text-[19px] leading-tight">{r.companyName}</div>
                <div className="text-[14px] text-ink/70 mt-0.5">
                  {r.recipient?.name
                    ? `${r.recipient.name} · ${r.recipient.title ?? ""}`
                    : "(no contact)"}{" "}
                  {r.recipient?.email ? `· ${r.recipient.email}` : ""}
                </div>
                {r.subject && (
                  <div className="text-[14px] mt-1 italic text-ink/75">
                    "{r.subject}"
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {r.sent && <span className="chip chip-success">sent</span>}
                {r.redirectedTo && (
                  <span className="chip chip-info">dev → {r.redirectedTo}</span>
                )}
                {r.savedEml && <span className="chip chip-warn">drafted</span>}
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
  rot,
}: {
  n: number;
  label: string;
  tone: "success" | "warn" | "danger";
  rot: number;
}) {
  const bg =
    tone === "success" ? "#d9edd9" : tone === "warn" ? "#fbeecb" : "#ffd9d9";
  return (
    <div
      className="p-5 border-[3px] border-ink"
      style={{
        background: bg,
        borderRadius: "52% 48% 46% 54% / 54% 48% 52% 46%",
        boxShadow: "4px 4px 0 0 #2d2d2d",
        transform: `rotate(${rot}deg)`,
      }}
    >
      <div className="font-display font-bold text-[38px] leading-none">{n}</div>
      <div className="font-display font-bold text-[13px] mt-1 uppercase tracking-wide text-ink/70">
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading states                                                       */
/* ------------------------------------------------------------------ */

function LoadingSearch() {
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="spinner" />
        <div>
          <div className="font-display font-bold text-[22px]">Poking Crustdata…</div>
          <div className="text-[15px] text-ink/70">Scoring candidates against your heuristics.</div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="card p-5"
            style={{ transform: `rotate(${((i % 3) - 1) * 0.6}deg)` }}
          >
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-4 w-1/2 mt-3" />
            <div className="mt-5 flex gap-2">
              <div className="skeleton h-6 w-14" />
              <div className="skeleton h-6 w-12" />
              <div className="skeleton h-6 w-16" />
            </div>
            <div className="skeleton h-4 w-full mt-5" />
            <div className="skeleton h-4 w-5/6 mt-2" />
            <div className="skeleton h-4 w-4/6 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingGenerate({ count }: { count: number }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="spinner" />
        <div>
          <div className="font-display font-bold text-[22px]">
            Sketching {count} landing page{count === 1 ? "" : "s"}…
          </div>
          <div className="text-[15px] text-ink/70">
            Claude Opus 4.7 is scribbling in parallel — about 30 seconds.
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: Math.max(count, 3) }).map((_, i) => (
          <div
            key={i}
            className="card overflow-hidden p-0"
            style={{ transform: `rotate(${((i % 3) - 1) * 0.6}deg)` }}
          >
            <div className="p-4 border-b-2 border-dashed border-ink/25 flex items-center gap-3">
              <div className="skeleton h-9 w-9" style={{ borderRadius: "50%" }} />
              <div className="flex-1">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/2 mt-2" />
              </div>
            </div>
            <div className="skeleton rounded-none" style={{ aspectRatio: "16/10", border: "none", borderRadius: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSend({ count }: { count: number }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="spinner" />
      <div className="mt-5 font-display font-bold text-[26px] leading-tight">
        Stuffing {count} envelope{count === 1 ? "" : "s"}…
      </div>
      <div className="text-[15px] text-ink/70 mt-1">
        Attaching previews and personalizing copy.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                               */
/* ------------------------------------------------------------------ */

function ActionBar({
  eyebrow,
  title,
  subtitle,
  backLabel,
  onBack,
  primary,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  primary: React.ReactNode;
}) {
  return (
    <div className="card p-5 md:p-6 flex items-start md:items-center justify-between gap-4 flex-wrap" style={{ transform: "rotate(-0.3deg)" }}>
      <span className="tape" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onBack}
          className="text-[14px] text-ink/70 hover:text-accent transition underline decoration-dashed underline-offset-4"
        >
          ← {backLabel}
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="tag">{eyebrow}</span>
          <h2 className="font-display font-bold text-[26px] md:text-[32px] leading-tight">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-[15px] text-ink/75 mt-1.5">{subtitle}</p>
        )}
      </div>
      <div className="shrink-0">{primary}</div>
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
        <label className="lbl">price offered (USD)</label>
        <input
          className="field"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="lbl">payment details</label>
        <input
          className="field"
          value={paymentDetails}
          onChange={(e) => setPaymentDetails(e.target.value)}
        />
      </div>
      <div>
        <label className="lbl">your name</label>
        <input className="field" value={fromName} onChange={(e) => setFromName(e.target.value)} />
      </div>
      <div>
        <label className="lbl">your email</label>
        <input className="field" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button className="btn btn-accent" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
