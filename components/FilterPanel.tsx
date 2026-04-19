"use client";
import { useEffect, useRef, useState } from "react";

export type SearchFilters = {
  industries: string[];
  countries: string[];
  fundingMin?: number;
  fundingMax?: number;
  revenueMin?: number;
  revenueMax?: number;
};

export const EMPTY_FILTERS: SearchFilters = {
  industries: [],
  countries: ["USA", "CAN", "GBR", "AUS"],
};

// ISO3 code + display name. Covers most of the v2 index's populated countries.
const COUNTRIES: { code: string; name: string }[] = [
  { code: "USA", name: "United States" },
  { code: "CAN", name: "Canada" },
  { code: "GBR", name: "United Kingdom" },
  { code: "AUS", name: "Australia" },
  { code: "IND", name: "India" },
  { code: "DEU", name: "Germany" },
  { code: "FRA", name: "France" },
  { code: "ESP", name: "Spain" },
  { code: "ITA", name: "Italy" },
  { code: "NLD", name: "Netherlands" },
  { code: "IRL", name: "Ireland" },
  { code: "SGP", name: "Singapore" },
  { code: "JPN", name: "Japan" },
  { code: "BRA", name: "Brazil" },
  { code: "MEX", name: "Mexico" },
  { code: "SWE", name: "Sweden" },
];

export function FilterPanel({
  value,
  onChange,
}: {
  value: SearchFilters;
  onChange: (f: SearchFilters) => void;
}) {
  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="eyebrow">
          <span className="num">·</span> FILTERS
        </div>
        <button
          className="btn btn-ghost text-xs"
          onClick={() => onChange(EMPTY_FILTERS)}
          type="button"
        >
          Reset
        </button>
      </div>

      <IndustryField
        selected={value.industries}
        onChange={(industries) => onChange({ ...value, industries })}
      />

      <CountryField
        selected={value.countries}
        onChange={(countries) => onChange({ ...value, countries })}
      />

      <RangeField
        label="Funding raised (USD)"
        help="funding.total_investment_usd on Crustdata v2"
        min={value.fundingMin}
        max={value.fundingMax}
        onChange={(mn, mx) =>
          onChange({ ...value, fundingMin: mn, fundingMax: mx })
        }
        presets={[
          { label: "Any", min: undefined, max: undefined },
          { label: "< $500k", min: undefined, max: 500_000 },
          { label: "$500k – $2M", min: 500_000, max: 2_000_000 },
          { label: "$2M – $15M", min: 2_000_000, max: 15_000_000 },
          { label: "$15M+", min: 15_000_000, max: undefined },
        ]}
      />

      <RangeField
        label="Estimated revenue (USD, upper bound)"
        help="revenue.estimated.upper_bound_usd on Crustdata v2"
        min={value.revenueMin}
        max={value.revenueMax}
        onChange={(mn, mx) =>
          onChange({ ...value, revenueMin: mn, revenueMax: mx })
        }
        presets={[
          { label: "Any", min: undefined, max: undefined },
          { label: "< $1M", min: undefined, max: 1_000_000 },
          { label: "$1M – $10M", min: 1_000_000, max: 10_000_000 },
          { label: "$10M – $100M", min: 10_000_000, max: 100_000_000 },
          { label: "$100M+", min: 100_000_000, max: undefined },
        ]}
      />
    </div>
  );
}

// ---------- industry (autocomplete from Crustdata) ----------

function IndustryField({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (!open) return;
    t.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/autocomplete?field=taxonomy.professional_network_industry&q=${encodeURIComponent(q)}`
        );
        const data = await r.json();
        setSuggestions((data.suggestions ?? []).slice(0, 20));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [q, open]);

  return (
    <div className="space-y-2">
      <label className="lbl">Industry</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <button
              key={s}
              type="button"
              className="chip chip-info gap-1 hover:opacity-80"
              onClick={() => onChange(selected.filter((x) => x !== s))}
              title="Click to remove"
            >
              {s} <span className="opacity-60">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          className="field"
          placeholder="Search LinkedIn industries… (e.g. Software, Retail)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {open && (suggestions.length > 0 || loading) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 card max-h-64 overflow-auto p-1">
            {loading && <div className="px-3 py-2 text-xs text-mute">Loading…</div>}
            {suggestions
              .filter((s) => !selected.includes(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-paper-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([...selected, s]);
                    setQ("");
                  }}
                >
                  {s}
                </button>
              ))}
            {!loading && suggestions.length === 0 && (
              <div className="px-3 py-2 text-xs text-mute">No matches</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- country (fixed multi-select) ----------

function CountryField({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (code: string) =>
    selected.includes(code)
      ? onChange(selected.filter((c) => c !== code))
      : onChange([...selected, code]);
  return (
    <div className="space-y-2">
      <label className="lbl">Location (country)</label>
      <div className="flex flex-wrap gap-1.5">
        {COUNTRIES.map((c) => {
          const active = selected.includes(c.code);
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => toggle(c.code)}
              className={`chip ${active ? "chip-info" : ""}`}
              title={c.name}
            >
              {c.code}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <div className="text-[11px] text-warn">Pick at least one country.</div>
      )}
    </div>
  );
}

// ---------- generic numeric range with preset chips ----------

function RangeField({
  label,
  help,
  min,
  max,
  onChange,
  presets,
}: {
  label: string;
  help: string;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
  presets: { label: string; min?: number; max?: number }[];
}) {
  const activePreset = presets.find(
    (p) => (p.min ?? undefined) === min && (p.max ?? undefined) === max
  );
  return (
    <div className="space-y-2">
      <label className="lbl">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.min, p.max)}
            className={`chip ${activePreset?.label === p.label ? "chip-info" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="field"
          type="number"
          placeholder="min"
          value={min ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value === "" ? undefined : Number(e.target.value),
              max
            )
          }
        />
        <input
          className="field"
          type="number"
          placeholder="max"
          value={max ?? ""}
          onChange={(e) =>
            onChange(
              min,
              e.target.value === "" ? undefined : Number(e.target.value)
            )
          }
        />
      </div>
      <div className="text-[10px] text-mute font-mono">{help}</div>
    </div>
  );
}
