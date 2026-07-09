"use client";

import { useEffect, useState } from "react";

export function getWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem("watchlist") ?? "[]");
  } catch {
    return [];
  }
}

export function setWatchlist(list: string[]) {
  localStorage.setItem("watchlist", JSON.stringify(list));
  window.dispatchEvent(new Event("watchlist-change"));
}

export default function WatchButton({ symbol }: { symbol: string }) {
  const [watched, setWatched] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWatched(getWatchlist().includes(symbol));
    setReady(true);
  }, [symbol]);

  function toggle() {
    const list = getWatchlist();
    const next = list.includes(symbol) ? list.filter((s) => s !== symbol) : [...list, symbol];
    setWatchlist(next);
    setWatched(next.includes(symbol));
  }

  return (
    <button
      onClick={toggle}
      disabled={!ready}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        watched
          ? "border-amber/40 bg-amberdim text-amber"
          : "border-edge bg-panel text-mut hover:border-edge2 hover:text-fg"
      }`}
    >
      <span className="text-[13px]">{watched ? "★" : "☆"}</span>
      {watched ? "İzleniyor" : "İzle"}
    </button>
  );
}
