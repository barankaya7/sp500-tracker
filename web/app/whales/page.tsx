import Link from "next/link";
import { q, type WhaleFund, type WhaleHolding } from "@/lib/db";
import { fmtCap, fmtPct } from "@/lib/format";
import { Panel, SectionTitle, Empty } from "@/components/ui";

export const revalidate = 3600;
export const metadata = { title: "Balinalar" };

const CHANGE_TR: Record<string, { label: string; cls: string }> = {
  new: { label: "YENİ", cls: "text-up" },
  added: { label: "ARTIRDI", cls: "text-up" },
  reduced: { label: "AZALTTI", cls: "text-down" },
  sold_out: { label: "ÇIKTI", cls: "text-down" },
  unchanged: { label: "SABİT", cls: "text-dim" },
};

export default async function WhalesPage() {
  const [funds, holdings] = await Promise.all([
    q<WhaleFund>("whale_funds", "select=*&order=name", 3600),
    q<WhaleHolding>("whale_holdings", "select=*&order=value_usd.desc.nullslast&limit=2000", 3600),
  ]);

  const latestQuarter = holdings.map((h) => h.quarter).sort().at(-1);
  const current = holdings.filter((h) => h.quarter === latestQuarter);

  const byFund = new Map<string, WhaleHolding[]>();
  for (const h of current) {
    if (!byFund.has(h.cik)) byFund.set(h.cik, []);
    byFund.get(h.cik)!.push(h);
  }

  // dikkat çeken hamleler: yeni pozisyonlar + tam çıkışlar, değere göre
  const moves = current
    .filter((h) => h.change_type === "new" || h.change_type === "sold_out")
    .sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0))
    .slice(0, 12);

  return (
    <div>
      <SectionTitle sub={`Takip edilen ${funds.length} büyük fonun 13F pozisyonları${latestQuarter ? ` — ${latestQuarter}` : ""} (SEC verisi 45 gün gecikmelidir)`}>
        Balinalar
      </SectionTitle>

      {current.length === 0 ? (
        <Panel><Empty text="13F verisi bekleniyor — çeyreklik ingestion sonrası dolar." /></Panel>
      ) : (
        <div className="space-y-4">
          {moves.length > 0 && (
            <Panel title="Çeyreğin Dikkat Çeken Hamleleri">
              <div className="grid grid-cols-2 gap-px bg-edge sm:grid-cols-3 lg:grid-cols-4">
                {moves.map((m) => {
                  const c = CHANGE_TR[m.change_type ?? ""];
                  const fund = funds.find((f) => f.cik === m.cik);
                  return (
                    <Link key={`${m.cik}-${m.cusip}`} href={m.symbol ? `/stock/${m.symbol}` : "#"} className="bg-panel px-4 py-3 hover:bg-panel2">
                      <div className="flex items-baseline justify-between">
                        <span className="tnum text-[13px] font-semibold">{m.symbol ?? m.issuer_name?.slice(0, 10)}</span>
                        <span className={`text-[10px] font-bold ${c?.cls ?? ""}`}>{c?.label}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-dim">{fund?.name}</div>
                      <div className="tnum mt-1 text-[11px] text-mut">{fmtCap(m.value_usd)}</div>
                    </Link>
                  );
                })}
              </div>
            </Panel>
          )}

          {funds.filter((f) => byFund.has(f.cik)).map((f) => {
            const hs = byFund.get(f.cik)!.sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0)).slice(0, 10);
            return (
              <Panel key={f.cik} title={f.manager ? `${f.name} — ${f.manager}` : f.name}>
                <div className="divide-y divide-edge/50">
                  {hs.map((h) => {
                    const c = CHANGE_TR[h.change_type ?? ""];
                    return (
                      <Link key={h.cusip} href={h.symbol ? `/stock/${h.symbol}` : "#"} className="flex items-center gap-3 px-4 py-2 hover:bg-panel2">
                        <span className="tnum w-16 shrink-0 text-[13px] font-semibold">{h.symbol ?? "—"}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] text-dim">{h.issuer_name}</span>
                        <span className="tnum hidden text-[11px] text-mut sm:block">
                          {h.pct_of_portfolio != null ? `portföyün ${fmtPct(h.pct_of_portfolio, false)}` : ""}
                        </span>
                        <span className="tnum w-20 text-right text-[12px]">{fmtCap(h.value_usd)}</span>
                        <span className={`w-16 text-right text-[10px] font-bold ${c?.cls ?? "text-dim"}`}>{c?.label ?? ""}</span>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
