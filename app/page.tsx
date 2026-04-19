"use client";
import { useEffect, useState } from "react";
import { CompanyCard } from "@/components/CompanyCard";
import { PagePreview } from "@/components/PagePreview";
import type { AppConfig, LandingPage, OutreachResult, RankedCompany } from "@/lib/types";

type Step = "idle" | "searching" | "ranked" | "generating" | "generated" | "sending" | "sent";

export default function Dashboard() {
  const [step, setStep] = useState<Step>("idle");
  const [ranked, setRanked] = useState<RankedCompany[]>([]);
  const [pickedForGen, setPickedForGen] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [pickedForSend, setPickedForSend] = useState<Set<string>>(new Set());
  const [sendResults, setSendResults] = useState<OutreachResult[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const say = (m: string) => setLog((l) => [...l.slice(-20), `${new Date().toLocaleTimeString()} — ${m}`]);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig);
  }, []);

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
      setPickedForSend(new Set(data.pages.filter((p: LandingPage) => !p.error).map((p: LandingPage) => p.id)));
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
      say(`${sent} sent · ${drafted} drafted locally · ${data.results.length - sent - drafted} errored`);
      setStep("sent");
    } catch (e: any) {
      say(`error: ${e.message}`);
      setStep("generated");
    }
  }

  function toggle(set: Set<string>, id: string, update: (s: Set<string>) => void) {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    update(n);
  }

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Money<span className="text-accent">Maker</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Find companies that need websites → build them → sell them.
          </p>
        </div>
        <button className="btn" onClick={() => setConfigOpen((v) => !v)}>
          ⚙︎ Config
        </button>
      </header>

      {configOpen && config && (
        <ConfigPanel config={config} onSave={(c) => { setConfig(c); setConfigOpen(false); say("config saved"); }} />
      )}

      {/* STEP 1: Search */}
      <section className="mt-6 card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">1. Find prospects</h2>
            <p className="text-xs text-muted mt-1">
              Uses Crustdata search with heuristics in <code>lib/heuristics.ts</code>, then scores + picks the top N.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={startSearch}
            disabled={step === "searching" || step === "generating" || step === "sending"}
          >
            {step === "searching" ? "Searching…" : "Start search"}
          </button>
        </div>
      </section>

      {/* STEP 2: Ranked companies */}
      {ranked.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              2. Top {ranked.length} prospects — select which to generate pages for
            </h2>
            <button
              className="btn btn-primary"
              onClick={generate}
              disabled={pickedForGen.size === 0 || step === "generating"}
            >
              {step === "generating"
                ? `Generating ${pickedForGen.size}…`
                : `Generate ${pickedForGen.size} website${pickedForGen.size === 1 ? "" : "s"}`}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {ranked.map((c) => (
              <CompanyCard
                key={c.id}
                c={c}
                selected={pickedForGen.has(c.id)}
                onToggle={() => toggle(pickedForGen, c.id, setPickedForGen)}
              />
            ))}
          </div>
        </section>
      )}

      {/* STEP 3: Generated pages */}
      {pages.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              3. Generated landing pages — pick which to pitch
            </h2>
            <button
              className="btn btn-primary"
              onClick={send}
              disabled={pickedForSend.size === 0 || step === "sending"}
            >
              {step === "sending" ? `Sending ${pickedForSend.size}…` : `Send ${pickedForSend.size} email${pickedForSend.size === 1 ? "" : "s"}`}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((p) => (
              <PagePreview
                key={p.id}
                page={p}
                selected={pickedForSend.has(p.id)}
                onToggle={() => toggle(pickedForSend, p.id, setPickedForSend)}
              />
            ))}
          </div>
        </section>
      )}

      {/* STEP 4: Send results */}
      {sendResults.length > 0 && (
        <section className="mt-8 card p-5">
          <h2 className="font-semibold mb-3">4. Outreach results</h2>
          <ul className="divide-y divide-line">
            {sendResults.map((r) => (
              <li key={r.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{r.companyName}</div>
                  <div className="text-xs text-muted">
                    {r.recipient?.name ? `${r.recipient.name} · ${r.recipient.title ?? ""}` : "(no contact)"}{" "}
                    {r.recipient?.email ? `· ${r.recipient.email}` : ""}
                  </div>
                  {r.subject && <div className="text-xs mt-1 italic">“{r.subject}”</div>}
                </div>
                <div className="text-right text-xs whitespace-nowrap">
                  {r.sent && <span className="chip text-green-400 border-green-800/60">sent</span>}
                  {r.savedEml && <span className="chip text-amber-300 border-amber-800/60">drafted → {r.savedEml}</span>}
                  {r.error && <span className="chip text-red-400 border-red-900/60">{r.error}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Log */}
      <section className="mt-8 card p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-2">activity log</div>
        <pre className="text-[11px] text-white/70 whitespace-pre-wrap leading-5 max-h-40 overflow-auto">
{log.join("\n") || "—"}
        </pre>
      </section>

      <footer className="mt-10 text-center text-xs text-muted">
        Crustdata + Claude Opus 4.7. Edit heuristics in <code>lib/heuristics.ts</code>.
      </footer>
    </main>
  );
}

function ConfigPanel({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
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
    <div className="mt-4 card p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="lbl">Price offered (USD)</label>
        <input className="field" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      </div>
      <div>
        <label className="lbl">Payment details (shown in email)</label>
        <input className="field" value={paymentDetails} onChange={(e) => setPaymentDetails(e.target.value)} />
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
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}
