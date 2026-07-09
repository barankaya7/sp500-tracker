"use client";

import Link from "next/link";
import { cq, useData } from "@/lib/client";
import { type Earnings } from "@/lib/db";
import Skeleton from "@/components/Skeleton";
import { fmtDate } from "@/lib/format";
import { Panel, SectionTitle, Empty } from "@/components/ui";


type Row = Earnings & { stocks: { name: string; sector: string | null } | null };

export default function EarningsClient() {
  const { data: rows, loading } = useData(() => {
    const today = new Date().toISOString().slice(0, 10);
    return cq<Row>(
      "earnings_calendar",
      `select=*,stocks(name,sector)&earnings_date=gte.${today}&order=earnings_date&limit=200`
    );
  });
  if (loading || !rows) return <Skeleton rows={3} />;

  // tarihe göre grupla
  const byDate = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byDate.has(r.earnings_date)) byDate.set(r.earnings_date, []);
    byDate.get(r.earnings_date)!.push(r);
  }

  return (
    <div>
      <SectionTitle sub="S&P 500 şirketlerinin yaklaşan bilanço tarihleri">Bilanço Takvimi</SectionTitle>
      {rows.length === 0 ? (
        <Panel><Empty text="Bilanço verisi bekleniyor — günlük ingestion sonrası dolar." /></Panel>
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, items]) => (
            <Panel key={date} title={fmtDate(date)}>
              <div className="grid grid-cols-2 gap-px bg-edge sm:grid-cols-4">
                {items.map((r) => (
                  <Link key={r.symbol} href={`/stock/${r.symbol}`} className="bg-panel px-4 py-3 hover:bg-panel2">
                    <div className="tnum text-[13px] font-semibold">{r.symbol}</div>
                    <div className="truncate text-[11px] text-dim">{r.stocks?.name ?? ""}</div>
                  </Link>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
