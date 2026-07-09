-- sp500-tracker: full schema (Faz 1-4)

create table if not exists stocks (
  symbol text primary key,
  name text not null,
  sector text,
  sub_industry text,
  updated_at timestamptz default now()
);

create table if not exists prices_daily (
  symbol text not null references stocks(symbol) on delete cascade,
  date date not null,
  open numeric, high numeric, low numeric, close numeric,
  volume bigint,
  primary key (symbol, date)
);
create index if not exists idx_prices_daily_date on prices_daily(date);

create table if not exists quotes_latest (
  symbol text primary key references stocks(symbol) on delete cascade,
  price numeric,
  change_pct numeric,
  volume bigint,
  updated_at timestamptz default now()
);

create table if not exists fundamentals (
  symbol text primary key references stocks(symbol) on delete cascade,
  market_cap bigint,
  trailing_pe numeric,
  forward_pe numeric,
  price_to_book numeric,
  profit_margin numeric,
  revenue_growth numeric,
  earnings_growth numeric,
  dividend_yield numeric,
  beta numeric,
  fifty_two_week_high numeric,
  fifty_two_week_low numeric,
  analyst_target_mean numeric,
  analyst_target_high numeric,
  analyst_target_low numeric,
  analyst_rating text,          -- strongBuy/buy/hold/sell
  analyst_count int,
  short_pct_of_float numeric,
  updated_at timestamptz default now()
);

-- Faz 2
create table if not exists insider_trades (
  id text primary key,           -- EDGAR accession no + row hash
  symbol text,
  filer_name text,
  filer_title text,
  transaction_date date,
  filing_date timestamptz,
  transaction_code text,         -- P=purchase, S=sale, A=award...
  shares numeric,
  price numeric,
  value numeric,                 -- shares * price
  shares_owned_after numeric,
  form_url text
);
create index if not exists idx_insider_symbol on insider_trades(symbol, transaction_date desc);
create index if not exists idx_insider_filing on insider_trades(filing_date desc);

create table if not exists whale_funds (
  cik text primary key,
  name text not null,
  manager text,                  -- Buffett, Ackman...
  slug text unique
);

create table if not exists whale_holdings (
  cik text not null references whale_funds(cik) on delete cascade,
  quarter text not null,         -- '2026Q1'
  symbol text,
  cusip text not null,
  issuer_name text,
  shares numeric,
  value_usd numeric,
  pct_of_portfolio numeric,
  change_type text,              -- new / added / reduced / sold_out / unchanged
  shares_change numeric,
  primary key (cik, quarter, cusip)
);
create index if not exists idx_whale_symbol on whale_holdings(symbol, quarter);

create table if not exists congress_trades (
  id text primary key,           -- source hash
  politician text not null,
  chamber text,                  -- house / senate
  party text,
  symbol text,
  transaction_type text,         -- buy / sell
  amount_range text,             -- '$15K-$50K'
  amount_mid numeric,
  transaction_date date,
  disclosure_date date,
  source_url text
);
create index if not exists idx_congress_symbol on congress_trades(symbol, transaction_date desc);
create index if not exists idx_congress_disclosed on congress_trades(disclosure_date desc);

create table if not exists news (
  id text primary key,           -- source id / url hash
  symbol text,
  headline text not null,
  summary text,
  source text,
  url text,
  published_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_news_symbol on news(symbol, published_at desc);
create index if not exists idx_news_published on news(published_at desc);

create table if not exists short_interest (
  symbol text not null references stocks(symbol) on delete cascade,
  settlement_date date not null,
  short_interest bigint,
  avg_daily_volume bigint,
  days_to_cover numeric,
  primary key (symbol, settlement_date)
);

create table if not exists earnings_calendar (
  symbol text not null references stocks(symbol) on delete cascade,
  earnings_date date not null,
  eps_estimate numeric,
  time_hint text,                -- bmo / amc / unknown
  primary key (symbol, earnings_date)
);

-- Faz 3
create table if not exists scores_daily (
  symbol text not null references stocks(symbol) on delete cascade,
  date date not null,
  total numeric not null,
  momentum numeric,
  insider numeric,
  whale numeric,
  congress numeric,
  analyst numeric,
  delta numeric,                 -- total - previous total
  details jsonb,                 -- component reasons
  primary key (symbol, date)
);
create index if not exists idx_scores_date on scores_daily(date, total desc);

create table if not exists alerts_log (
  id bigint generated always as identity primary key,
  kind text not null,            -- insider_big_buy / cluster_buy / price_move / daily_digest
  symbol text,
  message text,
  dedupe_key text unique,
  sent_at timestamptz default now()
);

-- CUSIP → sembol önbelleği (13F parse için)
create table if not exists cusip_map (
  cusip text primary key,
  symbol text,
  source text                    -- name_match / openfigi / manual
);

-- job durumu (dashboard'da "veri tazeliği" göstermek için)
create table if not exists job_runs (
  job text primary key,
  last_run timestamptz,
  status text,
  detail text
);

-- RLS: herkese okuma, yazma sadece service role
do $$
declare t text;
begin
  foreach t in array array['stocks','prices_daily','quotes_latest','fundamentals','insider_trades',
    'whale_funds','whale_holdings','congress_trades','news','short_interest',
    'earnings_calendar','scores_daily','alerts_log','job_runs','cusip_map']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
