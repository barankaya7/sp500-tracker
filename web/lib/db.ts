const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** PostgREST sorgusu. Env yoksa veya hata olursa boş dizi döner — build asla kırılmaz. */
export async function q<T>(table: string, query: string, revalidate = 300): Promise<T[]> {
  if (!URL || !KEY) return [];
  try {
    const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      next: { revalidate },
    });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

export type Stock = { symbol: string; name: string; sector: string | null; sub_industry: string | null };
export type Quote = { symbol: string; price: number | null; change_pct: number | null; volume: number | null; updated_at: string };
export type PriceBar = { date: string; open: number; high: number; low: number; close: number; volume: number | null };
export type Fundamentals = {
  symbol: string; market_cap: number | null; trailing_pe: number | null; forward_pe: number | null;
  price_to_book: number | null; profit_margin: number | null; revenue_growth: number | null;
  earnings_growth: number | null; dividend_yield: number | null; beta: number | null;
  fifty_two_week_high: number | null; fifty_two_week_low: number | null;
  analyst_target_mean: number | null; analyst_target_high: number | null; analyst_target_low: number | null;
  analyst_rating: string | null; analyst_count: number | null; short_pct_of_float: number | null;
};
export type InsiderTrade = {
  id: string; symbol: string | null; filer_name: string | null; filer_title: string | null;
  transaction_date: string | null; filing_date: string | null; transaction_code: string | null;
  shares: number | null; price: number | null; value: number | null; form_url: string | null;
};
export type WhaleFund = { cik: string; name: string; manager: string | null; slug: string | null };
export type WhaleHolding = {
  cik: string; quarter: string; symbol: string | null; cusip: string; issuer_name: string | null;
  shares: number | null; value_usd: number | null; pct_of_portfolio: number | null;
  change_type: string | null; shares_change: number | null;
};
export type CongressTrade = {
  id: string; politician: string; chamber: string | null; party: string | null; symbol: string | null;
  transaction_type: string | null; amount_range: string | null; amount_mid: number | null;
  transaction_date: string | null; disclosure_date: string | null;
};
export type NewsItem = {
  id: string; symbol: string | null; headline: string; summary: string | null;
  source: string | null; url: string | null; published_at: string | null;
};
export type Score = {
  symbol: string; date: string; total: number; momentum: number | null; insider: number | null;
  whale: number | null; congress: number | null; analyst: number | null; delta: number | null;
  details: Record<string, string> | null;
};
export type Earnings = { symbol: string; earnings_date: string; eps_estimate: number | null; time_hint: string | null };
export type JobRun = { job: string; last_run: string | null; status: string | null; detail: string | null };
