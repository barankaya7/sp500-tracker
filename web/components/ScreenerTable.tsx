"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtPrice, fmtPct, fmtCap, fmtRatio } from "@/lib/format";
import { ChangePill } from "@/components/ui";

export type Row = {
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  changePct: number | null;
  marketCap: number | null;
  pe: number | null;
  upside: number | null;
  from52High: number | null;
  divYield: number | null;
  score: number | null;
};

type SortKey = keyof Row;

const COLS: { key: SortKey; label: string; cls?: string }[] = [
  { key: "symbol", label: "Sembol" },
  { key: "price", label: "Fiyat" },
  { key: "changePct", label: "Değişim" },
  { key: "marketCap", label: "Piy. Değeri" },
  { key: "pe", label: "F/K" },
  { key: "upside", label: "Hedef ↑", cls: "hidden sm:table-cell" },
  { key: "from52High", label: "52H Zirve", cls: "hidden md:table-cell" },
  { key: "score", label: "Skor" },
];

export default function ScreenerTable({
  rows,
  sectors,
  initialSector,
  initialSort,
}: {
  rows: Row[];
  sectors: string[];
  initialSector: string;
  initialSort: string;
}) {
  const [text, setText] = useState("");
  const [sector, setSector] = useState(initialSector);
  const [sortKey, setSortKey] = useState<SortKey>(initialSort === "score" ? "score" : "marketCap");
  const [asc, setAsc] = useState(false);

  const filtered = useMemo(() => {
    const s = text.trim().toLowerCase();
    let out = rows;
    if (sector) out = out.filter((r) => r.sector === sector);
    if (s) out = out.filter((r) => r.symbol.toLowerCase().includes(s) || r.name.toLowerCase().includes(s));
    return [...out].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
  }, [rows, text, sector, sortKey, asc]);

  function clickSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(k === "symbol");
    }
  }

  return (
    <div className="rise">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filtrele…"
          className="w-40 rounded-lg border border-edge bg-panel px-3 py-1.5 text-[13px] placeholder-dim outline-none focus:border-edge2"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-edge bg-panel px-2 py-1.5 text-[13px] text-mut outline-none"
        >
          <option value="">Tüm sektörler</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="tnum ml-auto text-[12px] text-dim">{filtered.length} hisse</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge bg-panel">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-edge text-left">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => clickSort(c.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-mut hover:text-fg ${c.cls ?? ""} ${c.key !== "symbol" ? "text-right" : ""}`}
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1 text-amber">{asc ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 503).map((r) => (
              <tr key={r.symbol} className="border-b border-edge/50 last:border-0 hover:bg-panel2">
                <td className="px-3 py-2">
                  <Link href={`/stock/${r.symbol}`} className="block">
                    <span className="tnum font-semibold">{r.symbol}</span>
                    <span className="ml-2 hidden text-[11px] text-dim lg:inline">{r.name.slice(0, 28)}</span>
                  </Link>
                </td>
                <td className="tnum px-3 py-2 text-right">{fmtPrice(r.price)}</td>
                <td className="px-3 py-2 text-right"><ChangePill value={r.changePct} /></td>
                <td className="tnum px-3 py-2 text-right text-mut">{fmtCap(r.marketCap)}</td>
                <td className="tnum px-3 py-2 text-right text-mut">{fmtRatio(r.pe)}</td>
                <td className={`tnum px-3 py-2 text-right ${r.upside != null && r.upside > 0 ? "text-up" : "text-mut"} hidden sm:table-cell`}>
                  {r.upside == null ? "—" : fmtPct(r.upside)}
                </td>
                <td className="tnum hidden px-3 py-2 text-right text-mut md:table-cell">
                  {r.from52High == null ? "—" : fmtPct(r.from52High)}
                </td>
                <td className="tnum px-3 py-2 text-right font-semibold text-amber">
                  {r.score == null ? "—" : Math.round(r.score)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
