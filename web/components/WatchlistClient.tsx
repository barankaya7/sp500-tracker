"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWatchlist, setWatchlist } from "@/components/WatchButton";
import { fmtPrice } from "@/lib/format";
import { ChangePill, Panel, Empty } from "@/components/ui";

type Row = { symbol: string; price: number | null; change_pct: number | null; stocks: { name: string } | null };

export default function WatchlistClient() {
  const [rows, setRows] = useState<Row[] | null>(null);

  async function load() {
    const list = getWatchlist();
    if (list.length === 0) {
      setRows([]);
      return;
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setRows([]);
      return;
    }
    const res = await fetch(
      `${url}/rest/v1/quotes_latest?select=symbol,price,change_pct,stocks(name)&symbol=in.(${list.map((s) => `"${s}"`).join(",")})`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const data: Row[] = res.ok ? await res.json() : [];
    // localStorage sırasını koru; quote'u olmayanları da göster
    const bySym = new Map(data.map((r) => [r.symbol, r]));
    setRows(list.map((s) => bySym.get(s) ?? { symbol: s, price: null, change_pct: null, stocks: null }));
  }

  useEffect(() => {
    load();
    window.addEventListener("watchlist-change", load);
    return () => window.removeEventListener("watchlist-change", load);
  }, []);

  if (rows === null) return <Empty text="Yükleniyor…" />;
  if (rows.length === 0)
    return (
      <Panel>
        <div className="px-4 py-12 text-center">
          <div className="text-3xl">☆</div>
          <p className="mt-2 text-[13px] text-mut">Listen boş. Bir hisse sayfasına gidip <span className="text-amber">İzle</span> butonuna bas.</p>
          <Link href="/screener" className="mt-4 inline-block rounded-lg border border-edge bg-panel2 px-4 py-2 text-[13px] font-medium hover:border-edge2">
            Taramaya git
          </Link>
        </div>
      </Panel>
    );

  return (
    <Panel>
      <div className="divide-y divide-edge/50">
        {rows.map((r) => (
          <div key={r.symbol} className="flex items-center gap-3 px-4 py-2.5">
            <Link href={`/stock/${r.symbol}`} className="min-w-0 flex-1">
              <div className="tnum text-[13px] font-semibold">{r.symbol}</div>
              <div className="truncate text-[11px] text-dim">{r.stocks?.name ?? ""}</div>
            </Link>
            <div className="tnum text-[13px]">{fmtPrice(r.price)}</div>
            <div className="w-20 text-right">
              <ChangePill value={r.change_pct} />
            </div>
            <button
              onClick={() => setWatchlist(getWatchlist().filter((s) => s !== r.symbol))}
              className="rounded-md px-2 py-1 text-[11px] text-dim hover:bg-downdim hover:text-down"
              title="Listeden çıkar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
