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
      className="group relative card p-5 text-left w-full transition-transform duration-100 hover:-rotate-1"
      style={{
        background: selected ? "#fff9c4" : "#ffffff",
        boxShadow: selected ? "6px 6px 0 0 #2d2d2d" : "4px 4px 0 0 #2d2d2d",
      }}
    >
      {selected && <span className="thumbtack" aria-hidden />}

      <div className="flex items-start justify-between gap-3 pr-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-[20px] leading-tight text-ink truncate">
            {c.name}
          </div>
          <div className="text-[14px] text-ink/65 truncate mt-0.5">
            {c.industry ?? "—"} · {c.location ?? "—"}
          </div>
        </div>
        <div
          className="shrink-0 h-14 w-14 flex flex-col items-center justify-center border-[3px] border-ink bg-paper"
          style={{
            borderRadius: "52% 48% 46% 54% / 54% 48% 52% 46%",
            boxShadow: "3px 3px 0 0 #2d2d2d",
            transform: "rotate(-4deg)",
          }}
          aria-hidden
        >
          <div className="font-display font-bold text-[22px] leading-none text-accent">
            {c.score}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-ink/60 mt-0.5">score</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {c.employee_count ? <span className="chip">{c.employee_count} emp</span> : null}
        {c.founded_year ? <span className="chip">est. {c.founded_year}</span> : null}
        <span className="chip">rev ≤ {revLabel}</span>
        {c.decision_makers_count ? <span className="chip">{c.decision_makers_count} DMs</span> : null}
      </div>

      {c.reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-[15px] text-ink/85 leading-snug">
          {c.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent shrink-0">›</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 pt-3 border-t-2 border-dashed border-ink/25 text-[13px] text-ink/70 flex items-center justify-between">
        <span>{selected ? "picked — click to drop" : "click to pick"}</span>
        <span
          className={`inline-flex items-center justify-center h-6 w-6 border-2 border-ink ${
            selected ? "bg-accent text-white" : "bg-white"
          }`}
          style={{
            borderRadius: "52% 48% 46% 54% / 54% 48% 52% 46%",
            boxShadow: "2px 2px 0 0 #2d2d2d",
          }}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
      </div>
    </button>
  );
}
