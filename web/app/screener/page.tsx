import { q } from "@/lib/db";
import { SectionTitle } from "@/components/ui";
import ScreenerTable, { type Row } from "@/components/ScreenerTable";

export const revalidate = 120;
export const metadata = { title: "Tarama" };

type Raw = {
  symbol: string;
  name: string;
  sector: string | null;
  quotes_latest: { price: number | null; change_pct: number | null; volume: number | null } | null;
  fundamentals: {
    market_cap: number | null;
    trailing_pe: number | null;
    analyst_target_mean: number | null;
    fifty_two_week_high: number | null;
    dividend_yield: number | null;
  } | null;
  scores_daily: { total: number; date: string }[];
};

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const raw = await q<Raw>(
    "stocks",
    "select=symbol,name,sector," +
      "quotes_latest(price,change_pct,volume)," +
      "fundamentals(market_cap,trailing_pe,analyst_target_mean,fifty_two_week_high,dividend_yield)," +
      `scores_daily(total,date)&scores_daily.order=date.desc&scores_daily.limit=1`,
    120
  );

  const rows: Row[] = raw.map((r) => {
    const price = r.quotes_latest?.price ?? null;
    const target = r.fundamentals?.analyst_target_mean ?? null;
    const high52 = r.fundamentals?.fifty_two_week_high ?? null;
    return {
      symbol: r.symbol,
      name: r.name,
      sector: r.sector ?? "—",
      price,
      changePct: r.quotes_latest?.change_pct ?? null,
      marketCap: r.fundamentals?.market_cap ?? null,
      pe: r.fundamentals?.trailing_pe ?? null,
      upside: price && target ? (target / price - 1) * 100 : null,
      from52High: price && high52 ? (price / high52 - 1) * 100 : null,
      divYield: r.fundamentals?.dividend_yield ?? null,
      score: r.scores_daily?.[0]?.total ?? null,
    };
  });

  const sectors = [...new Set(rows.map((r) => r.sector))].filter((s) => s !== "—").sort();

  return (
    <div>
      <SectionTitle sub="503 hisseyi filtrele, sırala, karşılaştır">Tarama</SectionTitle>
      <ScreenerTable rows={rows} sectors={sectors} initialSector={sp.sector ?? ""} initialSort={sp.sort ?? ""} />
    </div>
  );
}
