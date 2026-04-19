"use client";
import type { RankedCompany } from "@/lib/types";

export function CompanyCard({
  c,
  selected,
  onToggle,
}: {
  c: RankedCompany;
  selected: boolean;
  onToggle: () => void;
}) {
  const rev = c.revenue_range?.estimatedMaxRevenue;
  const revLabel = rev
    ? `$${rev.amount}${rev.unit === "BILLION" ? "B" : rev.unit === "MILLION" ? "M" : ""}`
    : "—";

  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      className={`group relative card p-5 text-left transition-all duration-200
        hover:-translate-y-0.5 hover:border-white/20
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
        ${selected ? "ring-2 ring-accent border-transparent shadow-glow" : ""}`}
    >
      {selected && (
        <span
          className="absolute top-3 right-3 inline-flex items-center justify-center
                     h-6 w-6 rounded-full bg-gradient-to-br from-accent to-accent2 text-white text-xs
                     shadow-glow animate-pop-in"
          aria-hidden
        >
          ✓
        </span>
      )}

      <div className="flex items-start justify-between gap-3 pr-7">
        <div className="min-w-0">
          <div className="font-semibold truncate text-white">{c.name}</div>
          <div className="text-xs text-muted truncate mt-0.5">
            {c.industry ?? "—"} · {c.location ?? "—"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted">score</div>
          <div className="text-2xl font-bold bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent leading-none">
            {c.score}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.employee_count ? <span className="chip">{c.employee_count} emp</span> : null}
        {c.founded_year ? <span className="chip">est. {c.founded_year}</span> : null}
        <span className="chip">rev ≤ {revLabel}</span>
        {c.decision_makers_count ? <span className="chip">{c.decision_makers_count} DMs</span> : null}
      </div>

      {c.reasons.length > 0 && (
        <ul className="mt-4 space-y-1 text-[11.5px] text-white/65">
          {c.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="flex gap-2 leading-snug">
              <span className="text-accent/70 shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 pt-3 border-t border-line/70 text-[11px] text-muted">
        {selected ? "Selected — click to deselect" : "Click to select"}
      </div>
    </button>
  );
}
