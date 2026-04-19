"use client";
import { useEffect, useState } from "react";
import type { LandingPage } from "@/lib/types";

export function PagePreview({
  page,
  selected,
  onToggle,
}: {
  page: LandingPage;
  selected: boolean;
  onToggle: () => void;
}) {
  const [full, setFull] = useState(false);
  const src = `/api/preview/${page.id}`;

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (page.error) {
    return (
      <div className="card p-5 border-rose-800/60 bg-rose-950/20">
        <div className="font-semibold text-white">{page.company.name}</div>
        <div className="mt-2 text-xs text-rose-300 leading-relaxed">{page.error}</div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`card overflow-hidden transition-all duration-200
          ${selected ? "ring-2 ring-accent border-transparent shadow-glow" : "hover:border-white/20"}`}
      >
        <div className="flex items-center justify-between gap-2 p-3.5 border-b border-line">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-md bg-gradient-to-br from-accent/30 to-accent2/30 border border-line flex items-center justify-center text-[11px] font-semibold text-white/80">
              {page.company.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate text-sm">{page.company.name}</div>
              <div className="text-[11px] text-muted truncate">
                {page.company.domain ?? page.company.location ?? ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button className="btn btn-ghost" onClick={() => setFull(true)} aria-label="Open fullscreen">
              ⤢
            </button>
            <button
              onClick={onToggle}
              aria-pressed={selected}
              className={`btn ${selected ? "btn-primary" : ""}`}
            >
              {selected ? "✓ selected" : "select"}
            </button>
          </div>
        </div>
        <div className="relative bg-ink" style={{ aspectRatio: "16/10" }}>
          <iframe
            src={src}
            className="absolute inset-0 w-full h-full"
            style={{ transform: "scale(0.55)", transformOrigin: "top left", width: "182%", height: "182%" }}
            sandbox="allow-same-origin"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/70 to-transparent" />
        </div>
      </div>

      {full && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur flex flex-col animate-fade-in">
          <div className="flex items-center justify-between p-3 border-b border-line bg-ink">
            <div className="min-w-0">
              <div className="font-semibold truncate">{page.company.name}</div>
              <div className="text-[11px] text-muted truncate">
                {page.company.domain ?? page.company.location ?? ""}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <a href={src} target="_blank" rel="noreferrer" className="btn btn-ghost">Open in new tab</a>
              <button className="btn" onClick={() => setFull(false)}>Close (Esc)</button>
            </div>
          </div>
          <iframe src={src} className="flex-1 w-full bg-white" />
        </div>
      )}
    </>
  );
}
