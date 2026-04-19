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
      <div className="card p-5" style={{ background: "#ffd9d9" }}>
        <span className="tag" style={{ background: "#ff4d4d", color: "#fff" }}>
          error
        </span>
        <div className="font-display font-bold text-[20px] mt-3 text-ink">
          {page.company.name}
        </div>
        <div className="mt-2 text-[14px] text-ink/80 leading-snug">{page.error}</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="card overflow-hidden p-0 relative"
        style={{
          background: selected ? "#fff9c4" : "#ffffff",
          boxShadow: selected ? "6px 6px 0 0 #2d2d2d" : "4px 4px 0 0 #2d2d2d",
        }}
      >
        <span className="tape" aria-hidden />
        <div className="flex items-center justify-between gap-2 p-4 border-b-2 border-dashed border-ink/25">
          <div className="min-w-0 flex items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 flex items-center justify-center font-display font-bold text-[13px] text-ink bg-paper border-[3px] border-ink"
              style={{
                borderRadius: "52% 48% 46% 54% / 54% 48% 52% 46%",
                boxShadow: "2px 2px 0 0 #2d2d2d",
                transform: "rotate(-4deg)",
              }}
              aria-hidden
            >
              {page.company.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[17px] text-ink leading-tight truncate">
                {page.company.name}
              </div>
              <div className="text-[13px] text-ink/65 truncate">
                {page.company.domain ?? page.company.location ?? ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setFull(true)}
              aria-label="Open fullscreen"
            >
              expand
            </button>
            <button
              onClick={onToggle}
              aria-pressed={selected}
              className={`btn btn-sm ${selected ? "btn-accent" : ""}`}
            >
              {selected ? "✓ picked" : "pick"}
            </button>
          </div>
        </div>
        <div
          className="relative bg-paper-2 border-b-2 border-ink"
          style={{ aspectRatio: "16/10" }}
        >
          <iframe
            src={src}
            className="absolute inset-0 w-full h-full"
            style={{
              transform: "scale(0.55)",
              transformOrigin: "top left",
              width: "182%",
              height: "182%",
            }}
            sandbox="allow-same-origin"
            loading="lazy"
          />
          {/* corner crop marks */}
          <CornerMarks />
        </div>
      </div>

      {full && (
        <div className="fixed inset-0 z-50 bg-ink/85 flex flex-col animate-fade-in p-2 md:p-4">
          <div
            className="bg-paper border-[3px] border-ink p-3 flex items-center justify-between"
            style={{
              borderRadius: "22px 10px 26px 14px / 14px 24px 10px 22px",
              boxShadow: "6px 6px 0 0 #000",
            }}
          >
            <div className="min-w-0">
              <div className="font-display font-bold text-[18px] truncate">
                {page.company.name}
              </div>
              <div className="text-[13px] text-ink/65 truncate">
                {page.company.domain ?? page.company.location ?? ""}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-secondary"
              >
                open new tab
              </a>
              <button className="btn btn-sm" onClick={() => setFull(false)}>
                close (Esc)
              </button>
            </div>
          </div>
          <iframe
            src={src}
            className="flex-1 w-full bg-white mt-2 md:mt-3 border-[3px] border-ink"
            style={{
              borderRadius: "22px 10px 26px 14px / 14px 24px 10px 22px",
              boxShadow: "6px 6px 0 0 #000",
            }}
          />
        </div>
      )}
    </>
  );
}

function CornerMarks() {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 18,
    height: 18,
    border: "2px solid #2d2d2d",
    background: "transparent",
    pointerEvents: "none",
  };
  return (
    <>
      <span style={{ ...base, top: 8, left: 8, borderRight: "none", borderBottom: "none" }} />
      <span style={{ ...base, top: 8, right: 8, borderLeft: "none", borderBottom: "none" }} />
      <span style={{ ...base, bottom: 8, left: 8, borderRight: "none", borderTop: "none" }} />
      <span style={{ ...base, bottom: 8, right: 8, borderLeft: "none", borderTop: "none" }} />
    </>
  );
}
