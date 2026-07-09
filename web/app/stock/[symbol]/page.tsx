import { notFound } from "next/navigation";
import {
  q, type Stock, type Quote, type PriceBar, type Fundamentals, type Score,
  type InsiderTrade, type WhaleHolding, type CongressTrade, type NewsItem, type Earnings,
} from "@/lib/db";
import { fmtPrice, fmtPct, fmtCap, fmtRatio, fmtDate, fmtDateTime, relTime, RATING_TR, fmtNum } from "@/lib/format";
import { ChangePill, Panel, Empty } from "@/components/ui";
import PriceChart from "@/components/PriceChart";
import WatchButton from "@/components/WatchButton";

export const revalidate = 120;

const TX_TR: Record<string, string> = { P: "Alış", S: "Satış", A: "Hisse Ödülü", D: "Devir", G: "Hediye", F: "Vergi Satışı", M: "Opsiyon" };

function Stat({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-panel2 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`tnum mt-0.5 text-[14px] font-semibold ${accent === "up" ? "text-up" : accent === "down" ? "text-down" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();

  const [stockArr, quoteArr, bars, fundArr, scoreArr, insiders, whales, congress, news, earnArr] = await Promise.all([
    q<Stock>("stocks", `select=*&symbol=eq.${symbol}`, 3600),
    q<Quote>("quotes_latest", `select=*&symbol=eq.${symbol}`, 60),
    q<PriceBar>("prices_daily", `select=date,open,high,low,close,volume&symbol=eq.${symbol}&order=date&limit=400`, 600),
    q<Fundamentals>("fundamentals", `select=*&symbol=eq.${symbol}`, 600),
    q<Score>("scores_daily", `select=*&symbol=eq.${symbol}&order=date.desc&limit=1`, 600),
    q<InsiderTrade>("insider_trades", `select=*&symbol=eq.${symbol}&order=filing_date.desc&limit=15`, 600),
    q<WhaleHolding & { whale_funds: { name: string; manager: string | null } | null }>(
      "whale_holdings", `select=*,whale_funds(name,manager)&symbol=eq.${symbol}&order=value_usd.desc&limit=15`, 3600),
    q<CongressTrade>("congress_trades", `select=*&symbol=eq.${symbol}&order=transaction_date.desc&limit=10`, 600),
    q<NewsItem>("news", `select=*&symbol=eq.${symbol}&order=published_at.desc&limit=12`, 300),
    q<Earnings>("earnings_calendar", `select=*&symbol=eq.${symbol}&earnings_date=gte.${new Date().toISOString().slice(0, 10)}&order=earnings_date&limit=1`, 600),
  ]);

  const stock = stockArr[0];
  if (!stock) notFound();
  const quote = quoteArr[0];
  const f = fundArr[0];
  const score = scoreArr[0];
  const nextEarnings = earnArr[0];

  const price = quote?.price ?? bars.at(-1)?.close ?? null;
  const upside = price && f?.analyst_target_mean ? (f.analyst_target_mean / price - 1) * 100 : null;

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="rise flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="tnum text-2xl font-bold tracking-tight">{symbol}</h1>
            {stock.sector && (
              <span className="rounded-full border border-edge bg-panel px-2.5 py-0.5 text-[11px] text-mut">{stock.sector}</span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-mut">{stock.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="tnum text-2xl font-bold">{fmtPrice(price)}</div>
            <div className="mt-0.5 flex items-center justify-end gap-2">
              <ChangePill value={quote?.change_pct} />
              {quote?.updated_at && <span className="text-[10px] text-dim">{relTime(quote.updated_at)}</span>}
            </div>
          </div>
          <WatchButton symbol={symbol} />
        </div>
      </div>

      {/* Skor */}
      {score && (
        <Panel title="Radar Skoru">
          <div className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="flex items-baseline gap-1">
              <span className="tnum text-4xl font-bold text-amber">{Math.round(score.total)}</span>
              <span className="text-[12px] text-dim">/100</span>
              {score.delta != null && score.delta !== 0 && (
                <span className={`tnum ml-2 text-[13px] font-medium ${score.delta > 0 ? "text-up" : "text-down"}`}>
                  {score.delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(score.delta))}
                </span>
              )}
            </div>
            <div className="grid flex-1 grid-cols-5 gap-2 text-center">
              {([
                ["Momentum", score.momentum, 25],
                ["Insider", score.insider, 25],
                ["Balina", score.whale, 20],
                ["Kongre", score.congress, 10],
                ["Analist", score.analyst, 20],
              ] as const).map(([label, v, max]) => (
                <div key={label}>
                  <div className="tnum text-[13px] font-semibold">{v == null ? "—" : Math.round(v)}<span className="text-[10px] text-dim">/{max}</span></div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-edge">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${((v ?? 0) / max) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-dim">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* Grafik */}
      <Panel>
        <PriceChart bars={bars.map((b) => ({ date: b.date, close: b.close }))} />
      </Panel>

      {/* Temel veriler */}
      <Panel title="Temel Veriler">
        {f ? (
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            <Stat label="Piyasa Değeri" value={fmtCap(f.market_cap)} />
            <Stat label="F/K" value={fmtRatio(f.trailing_pe)} />
            <Stat label="Forward F/K" value={fmtRatio(f.forward_pe)} />
            <Stat label="PD/DD" value={fmtRatio(f.price_to_book)} />
            <Stat label="Kâr Marjı" value={f.profit_margin != null ? fmtPct(f.profit_margin * 100, false) : "—"} />
            <Stat label="Gelir Büyümesi" value={f.revenue_growth != null ? fmtPct(f.revenue_growth * 100) : "—"}
              accent={f.revenue_growth != null ? (f.revenue_growth >= 0 ? "up" : "down") : undefined} />
            <Stat label="Temettü" value={f.dividend_yield != null ? fmtPct(f.dividend_yield, false) : "—"} />
            <Stat label="Beta" value={fmtRatio(f.beta)} />
            <Stat label="52H Yüksek" value={fmtPrice(f.fifty_two_week_high)} />
            <Stat label="52H Düşük" value={fmtPrice(f.fifty_two_week_low)} />
            <Stat label="Short / Float" value={f.short_pct_of_float != null ? fmtPct(f.short_pct_of_float * 100, false) : "—"} />
            <Stat label="Sonraki Bilanço" value={nextEarnings ? fmtDate(nextEarnings.earnings_date) : "—"} />
          </div>
        ) : <Empty text="Temel veri bekleniyor." />}
      </Panel>

      {/* Analist */}
      {f?.analyst_target_mean != null && (
        <Panel title="Analist Görünümü">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-dim">Ortalama Hedef</div>
              <div className="tnum text-lg font-bold">{fmtPrice(f.analyst_target_mean)}</div>
            </div>
            {upside != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-dim">Potansiyel</div>
                <div className={`tnum text-lg font-bold ${upside >= 0 ? "text-up" : "text-down"}`}>{fmtPct(upside)}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-dim">Bant</div>
              <div className="tnum text-[13px] text-mut">{fmtPrice(f.analyst_target_low)} – {fmtPrice(f.analyst_target_high)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-dim">Konsensus</div>
              <div className="text-[13px] font-medium text-amber">{RATING_TR[f.analyst_rating ?? "none"] ?? f.analyst_rating}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-dim">Analist</div>
              <div className="tnum text-[13px] text-mut">{f.analyst_count ?? "—"}</div>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Insider */}
        <Panel title="Insider İşlemleri">
          {insiders.length ? (
            <div className="divide-y divide-edge/50">
              {insiders.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{t.filer_name}</div>
                    <div className="truncate text-[11px] text-dim">{t.filer_title} · {fmtDate(t.transaction_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[12px] font-semibold ${t.transaction_code === "P" ? "text-up" : t.transaction_code === "S" ? "text-down" : "text-mut"}`}>
                      {TX_TR[t.transaction_code ?? ""] ?? t.transaction_code}
                    </div>
                    <div className="tnum text-[11px] text-mut">{t.value ? fmtCap(t.value) : t.shares ? fmtNum(t.shares, 0) + " adet" : "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="Bu hisse için insider işlemi kaydı yok." />}
        </Panel>

        {/* Balinalar */}
        <Panel title="Balina Pozisyonları (13F)">
          {whales.length ? (
            <div className="divide-y divide-edge/50">
              {whales.map((w) => (
                <div key={`${w.cik}-${w.quarter}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{w.whale_funds?.name}</div>
                    <div className="text-[11px] text-dim">{w.quarter} · portföyün {w.pct_of_portfolio != null ? fmtPct(w.pct_of_portfolio, false) : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[12px] font-semibold ${
                      w.change_type === "new" || w.change_type === "added" ? "text-up"
                      : w.change_type === "reduced" || w.change_type === "sold_out" ? "text-down" : "text-mut"}`}>
                      {{ new: "YENİ", added: "ARTIRDI", reduced: "AZALTTI", sold_out: "ÇIKTI", unchanged: "SABİT" }[w.change_type ?? ""] ?? "—"}
                    </div>
                    <div className="tnum text-[11px] text-mut">{w.value_usd ? fmtCap(w.value_usd) : "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="Takip edilen fonlarda bu hisse için pozisyon kaydı yok." />}
        </Panel>
      </div>

      {/* Kongre */}
      {congress.length > 0 && (
        <Panel title="Kongre İşlemleri">
          <div className="divide-y divide-edge/50">
            {congress.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{t.politician}</div>
                  <div className="text-[11px] text-dim">{t.chamber === "senate" ? "Senato" : "Temsilciler"} · {fmtDate(t.transaction_date)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[12px] font-semibold ${t.transaction_type === "buy" ? "text-up" : "text-down"}`}>
                    {t.transaction_type === "buy" ? "ALIŞ" : "SATIŞ"}
                  </div>
                  <div className="tnum text-[11px] text-mut">{t.amount_range ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Haberler */}
      <Panel title="Haberler">
        {news.length ? (
          <div className="divide-y divide-edge/50">
            {news.map((n) => (
              <a key={n.id} href={n.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-panel2">
                <div className="text-[13px] font-medium leading-snug">{n.headline}</div>
                <div className="mt-1 text-[11px] text-dim">{n.source} · {fmtDateTime(n.published_at)}</div>
              </a>
            ))}
          </div>
        ) : <Empty text="Bu hisse için haber kaydı yok." />}
      </Panel>
    </div>
  );
}
