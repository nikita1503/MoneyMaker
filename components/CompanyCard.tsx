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
  const revLabel = rev ? `$${rev.amount}${rev.unit === "BILLION" ? "B" : rev.unit === "MILLION" ? "M" : ""}` : "—";
  return (
    <button
      onClick={onToggle}
      className={`card p-4 text-left transition hover:-translate-y-0.5 ${
        selected ? "ring-2 ring-accent border-accent" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{c.name}</div>
          <div className="text-xs text-muted truncate">
            {c.industry ?? "—"} · {c.location ?? "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted">score</div>
          <div className="text-xl font-bold text-accent">{c.score}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.employee_count ? <span className="chip">{c.employee_count} emp</span> : null}
        {c.founded_year ? <span className="chip">{c.founded_year}</span> : null}
        <span className="chip">rev ≤ {revLabel}</span>
        {c.decision_makers_count ? <span className="chip">{c.decision_makers_count} DMs</span> : null}
      </div>

      {c.reasons.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[11px] text-white/60 list-disc list-inside">
          {c.reasons.slice(0, 4).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="accent-accent"
        />
        <span className="text-muted">{selected ? "selected" : "click to select"}</span>
      </div>
    </button>
  );
}
