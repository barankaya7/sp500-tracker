"use client";

import Link from "next/link";
import { cq, useData } from "@/lib/client";
import { type InsiderTrade } from "@/lib/db";
import Skeleton from "@/components/Skeleton";
import { fmtCap, fmtDate, fmtNum } from "@/lib/format";
import { Panel, SectionTitle, Empty } from "@/components/ui";


type Row = InsiderTrade & { stocks: { name: string } | null };

export default function InsidersClient() {
  const { data, loading } = useData(async () => {
    const [buys, sells] = await Promise.all([
      cq<Row>("insider_trades", "select=*,stocks(name)&transaction_code=eq.P&order=filing_date.desc&limit=60"),
      cq<Row>("insider_trades", "select=*,stocks(name)&transaction_code=eq.S&order=filing_date.desc&limit=30"),
    ]);
    return { buys, sells };
  });
  if (loading || !data) return <Skeleton rows={3} />;
  const { buys, sells } = data;

  // cluster buy: son 7 günde aynı hissede 2+ farklı insider alımı
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const recent = buys.filter((b) => (b.transaction_date ?? "") >= weekAgo);
  const bySym = new Map<string, Set<string>>();
  const valBySym = new Map<string, number>();
  for (const b of recent) {
    if (!b.symbol) continue;
    if (!bySym.has(b.symbol)) bySym.set(b.symbol, new Set());
    bySym.get(b.symbol)!.add(b.filer_name ?? "");
    valBySym.set(b.symbol, (valBySym.get(b.symbol) ?? 0) + (b.value ?? 0));
  }
  const clusters = [...bySym.entries()]
    .filter(([, names]) => names.size >= 2)
    .map(([sym, names]) => ({ sym, count: names.size, total: valBySym.get(sym) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  function TradeList({ rows, buy }: { rows: Row[]; buy: boolean }) {
    if (!rows.length) return <Empty text="Kayıt yok — Form 4 ingestion sonrası dolar." />;
    return (
      <div className="divide-y divide-edge/50">
        {rows.map((t) => (
          <Link key={t.id} href={t.symbol ? `/stock/${t.symbol}` : "#"} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2">
            <span className="tnum w-14 shrink-0 text-[13px] font-semibold">{t.symbol}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px]">{t.filer_name}</div>
              <div className="truncate text-[11px] text-dim">{t.filer_title} · {fmtDate(t.transaction_date)}</div>
            </div>
            <div className="text-right">
              <div className={`tnum text-[12px] font-semibold ${buy ? "text-up" : "text-down"}`}>
                {t.value ? fmtCap(t.value) : t.shares ? fmtNum(t.shares, 0) + " adet" : "—"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle sub="SEC Form 4 bildirimleri — şirket yöneticilerinin kendi hisselerindeki işlemleri">Insider İşlemleri</SectionTitle>
      <div className="space-y-4">
        {clusters.length > 0 && (
          <Panel title="Cluster Buy — Son 7 Günde Çoklu Insider Alımı">
            <div className="grid grid-cols-2 gap-px bg-edge sm:grid-cols-4">
              {clusters.slice(0, 8).map((c) => (
                <Link key={c.sym} href={`/stock/${c.sym}`} className="bg-panel px-4 py-3 hover:bg-panel2">
                  <div className="flex items-baseline justify-between">
                    <span className="tnum text-[13px] font-semibold">{c.sym}</span>
                    <span className="rounded bg-updim px-1.5 text-[10px] font-bold text-up">{c.count} KİŞİ</span>
                  </div>
                  <div className="tnum mt-1 text-[11px] text-mut">{fmtCap(c.total)}</div>
                </Link>
              ))}
            </div>
          </Panel>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Son Alımlar"><TradeList rows={buys.slice(0, 30)} buy /></Panel>
          <Panel title="Son Satışlar"><TradeList rows={sells} buy={false} /></Panel>
        </div>
      </div>
    </div>
  );
}
