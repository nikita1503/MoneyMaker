"use client";
import { useState } from "react";
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

  if (page.error) {
    return (
      <div className="card p-4 border-red-700/60">
        <div className="font-semibold">{page.company.name}</div>
        <div className="mt-2 text-xs text-red-400">{page.error}</div>
      </div>
    );
  }

  return (
    <>
      <div className={`card overflow-hidden ${selected ? "ring-2 ring-accent border-accent" : ""}`}>
        <div className="flex items-center justify-between gap-2 p-3 border-b border-line">
          <div className="min-w-0">
            <div className="font-semibold truncate">{page.company.name}</div>
            <div className="text-xs text-muted truncate">{page.company.domain ?? page.company.location ?? ""}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn-ghost btn" onClick={() => setFull(true)}>Fullscreen</button>
            <button
              onClick={onToggle}
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
          />
        </div>
      </div>

      {full && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-line bg-ink">
            <div className="font-semibold">{page.company.name} — full page</div>
            <div className="flex gap-2">
              <a href={src} target="_blank" className="btn btn-ghost">Open in new tab</a>
              <button className="btn" onClick={() => setFull(false)}>Close</button>
            </div>
          </div>
          <iframe src={src} className="flex-1 w-full bg-white" />
        </div>
      )}
    </>
  );
}
