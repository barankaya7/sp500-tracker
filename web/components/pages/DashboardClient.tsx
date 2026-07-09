"use client";

import Link from "next/link";
import { cq, useData } from "@/lib/client";
import type { Quote, Score, Earnings, InsiderTrade, CongressTrade } from "@/lib/db";
import { fmtPct, fmtDate, fmtCap } from "@/lib/format";
import { ChangePill, Panel, StockRow, Empty } from "@/components/ui";
import Skeleton from "@/components/Skeleton";

type QS = Quote & { stocks: { name: string; sector: string | null } | null };

export default function DashboardClient() {
  const { data, loading } = useData(async () => {
    const [quotes, scores, earnings, insiders, congress] = await Promise.all([
      cq<QS>("quotes_latest", "select=symbol,price,change_pct,volume,stocks(name,sector)"),
      cq<Score>("scores_daily", "select=*&order=date.desc,total.desc&limit=120"),
      cq<Earnings>("earnings_calendar", `select=*&earnings_date=gte.${new Date().toISOString().slice(0, 10)}&order=earnings_date&limit=8`),
      cq<InsiderTrade>("insider_trades", "select=*&transaction_code=eq.P&order=filing_date.desc&limit=6"),
      cq<CongressTrade>("congress_trades", "select=*&order=disclosure_date.desc&limit=6"),
    ]);
    return { quotes, scores, earnings, insiders, congress };
  });

  if (loading || !data) return <Skeleton rows={4} />;
  const { quotes, scores, earnings, insiders, congress } = data;

  const valid = quotes.filter((x) => x.change_pct != null);
  const upCount = valid.filter((x) => (x.change_pct ?? 0) > 0).length;
  const downCount = valid.filter((x) => (x.change_pct ?? 0) < 0).length;
  const avg = valid.length ? valid.reduce((s, x) => s + (x.change_pct ?? 0), 0) / valid.length : null;

  const gainers = [...valid].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 5);
  const losers = [...valid].sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 5);

  const sectorMap = new Map<string, number[]>();
  for (const x of valid) {
    const s = x.stocks?.sector;
    if (!s) continue;
    if (!sectorMap.has(s)) sectorMap.set(s, []);
    sectorMap.get(s)!.push(x.change_pct ?? 0);
  }
  const sectors = [...sectorMap.entries()]
    .map(([name, arr]) => ({ name, avg: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length }))
    .sort((a, b) => b.avg - a.avg);
  const maxAbs = Math.max(0.01, ...sectors.map((s) => Math.abs(s.avg)));

  const today = scores[0]?.date;
  const topScores = scores.filter((s) => s.date === today).slice(0, 6);
  const nameOf = (sym: string) => quotes.find((x) => x.symbol === sym)?.stocks?.name ?? "";
  const hasData = valid.length > 0;

  return (
    <div className="space-y-4">
      {/* Piyasa nabzı */}
      <Panel className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-edge">
          <div className="px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-mut">Ortalama Değişim</div>
            <div className={`tnum mt-1 text-2xl font-semibold ${avg == null ? "text-dim" : avg >= 0 ? "text-up" : "text-down"}`}>
              {avg == null ? "—" : fmtPct(avg)}
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-mut">Yükselen</div>
            <div className="tnum mt-1 text-2xl font-semibold text-up">{hasData ? upCount : "—"}</div>
          </div>
          <div className="px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-mut">Düşen</div>
            <div className="tnum mt-1 text-2xl font-semibold text-down">{hasData ? downCount : "—"}</div>
          </div>
        </div>
        {hasData && (
          <div className="flex h-1.5">
            <div className="bg-up" style={{ width: `${(upCount / valid.length) * 100}%` }} />
            <div className="bg-edge2" style={{ width: `${((valid.length - upCount - downCount) / valid.length) * 100}%` }} />
            <div className="bg-down" style={{ width: `${(downCount / valid.length) * 100}%` }} />
          </div>
        )}
      </Panel>

      {/* Günün sinyalleri */}
      {topScores.length > 0 && (
        <Panel
          title="Günün Sinyalleri"
          action={<Link href="/screener?sort=score" className="text-[11px] font-medium text-amber hover:underline">tümü →</Link>}
        >
          <div className="grid grid-cols-2 gap-px bg-edge sm:grid-cols-3">
            {topScores.map((s) => (
              <Link key={s.symbol} href={`/stock/${s.symbol}`} className="bg-panel px-4 py-3 transition-colors hover:bg-panel2">
                <div className="flex items-baseline justify-between">
                  <span className="tnum text-[13px] font-semibold">{s.symbol}</span>
                  <span className="tnum text-[15px] font-bold text-amber">{Math.round(s.total)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="truncate text-[11px] text-dim">{nameOf(s.symbol)}</span>
                  {s.delta != null && s.delta !== 0 && (
                    <span className={`tnum text-[11px] ${s.delta > 0 ? "text-up" : "text-down"}`}>
                      {s.delta > 0 ? "+" : ""}{Math.round(s.delta)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Yükselenler">
          {gainers.length ? gainers.map((x) => (
            <StockRow key={x.symbol} symbol={x.symbol} name={x.stocks?.name ?? ""} price={x.price} changePct={x.change_pct} />
          )) : <Empty text="Veri bekleniyor — ilk ingestion sonrası dolar." />}
        </Panel>
        <Panel title="Düşenler">
          {losers.length ? losers.map((x) => (
            <StockRow key={x.symbol} symbol={x.symbol} name={x.stocks?.name ?? ""} price={x.price} changePct={x.change_pct} />
          )) : <Empty text="Veri bekleniyor — ilk ingestion sonrası dolar." />}
        </Panel>
      </div>

      {/* Sektörler */}
      <Panel title="Sektör Performansı">
        {sectors.length ? (
          <div className="space-y-1 px-4 py-3">
            {sectors.map((s) => (
              <Link key={s.name} href={`/screener?sector=${encodeURIComponent(s.name)}`} className="group flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[12px] text-mut group-hover:text-fg">{s.name}</span>
                <div className="relative h-4 flex-1">
                  <div className="absolute inset-y-1 left-1/2 w-px bg-edge2" />
                  <div
                    className={`absolute inset-y-0.5 rounded-sm ${s.avg >= 0 ? "bg-up/70" : "bg-down/70"}`}
                    style={
                      s.avg >= 0
                        ? { left: "50%", width: `${(s.avg / maxAbs) * 48}%` }
                        : { right: "50%", width: `${(-s.avg / maxAbs) * 48}%` }
                    }
                  />
                </div>
                <span className={`tnum w-16 shrink-0 text-right text-[12px] ${s.avg >= 0 ? "text-up" : "text-down"}`}>
                  {fmtPct(s.avg)}
                </span>
              </Link>
            ))}
          </div>
        ) : <Empty text="Veri bekleniyor." />}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title="Son Insider Alımları"
          action={<Link href="/insiders" className="text-[11px] font-medium text-amber hover:underline">tümü →</Link>}
        >
          {insiders.length ? insiders.map((t) => (
            <StockRow
              key={t.id}
              symbol={t.symbol ?? "?"}
              name={`${t.filer_name ?? ""} · ${t.filer_title ?? ""}`}
              right={<span className="tnum text-[12px] font-medium text-up">{t.value ? "+" + fmtCap(t.value) : "—"}</span>}
            />
          )) : <Empty text="Henüz insider işlemi yok — veriler dolduğunda burada." />}
        </Panel>

        <Panel
          title="Kongre İşlemleri"
          action={<Link href="/congress" className="text-[11px] font-medium text-amber hover:underline">tümü →</Link>}
        >
          {congress.length ? congress.map((t) => (
            <StockRow
              key={t.id}
              symbol={t.symbol ?? "?"}
              name={t.politician}
              right={
                <span className={`tnum text-[12px] font-medium ${t.transaction_type === "buy" ? "text-up" : "text-down"}`}>
                  {t.transaction_type === "buy" ? "ALIŞ" : "SATIŞ"} {t.amount_range ?? ""}
                </span>
              }
            />
          )) : <Empty text="Henüz kongre işlemi yok — veriler dolduğunda burada." />}
        </Panel>
      </div>

      {earnings.length > 0 && (
        <Panel
          title="Yaklaşan Bilançolar"
          action={<Link href="/earnings" className="text-[11px] font-medium text-amber hover:underline">tümü →</Link>}
        >
          <div className="flex gap-px overflow-x-auto bg-edge">
            {earnings.map((e) => (
              <Link key={`${e.symbol}-${e.earnings_date}`} href={`/stock/${e.symbol}`} className="min-w-28 shrink-0 bg-panel px-4 py-3 hover:bg-panel2">
                <div className="tnum text-[13px] font-semibold">{e.symbol}</div>
                <div className="mt-0.5 text-[11px] text-dim">{fmtDate(e.earnings_date)}</div>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
