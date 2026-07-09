"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { symbol: string; name: string };

export default function Search({ stocks }: { stocks: Item[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (s.length < 1) return [];
    const bySym = stocks.filter((x) => x.symbol.toLowerCase().startsWith(s));
    const byName = stocks.filter(
      (x) => !x.symbol.toLowerCase().startsWith(s) && x.name.toLowerCase().includes(s)
    );
    return [...bySym, ...byName].slice(0, 8);
  }, [query, stocks]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(symbol: string) {
    setQuery("");
    setOpen(false);
    router.push(`/stock/${symbol}`);
  }

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-xs sm:max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5 focus-within:border-edge2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-dim">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && results[idx]) go(results[idx].symbol);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Sembol veya şirket ara…"
          className="w-full bg-transparent text-[13px] text-fg placeholder-dim outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-edge bg-panel2 shadow-xl shadow-black/50">
          {results.map((r, i) => (
            <button
              key={r.symbol}
              onMouseDown={(e) => { e.preventDefault(); go(r.symbol); }}
              onMouseEnter={() => setIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === idx ? "bg-edge" : ""}`}
            >
              <span className="tnum w-14 shrink-0 text-[12px] font-semibold text-amber">{r.symbol}</span>
              <span className="truncate text-[12px] text-mut">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
