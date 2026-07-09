import Link from "next/link";
import { q, type CongressTrade } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Panel, SectionTitle, Empty } from "@/components/ui";

export const revalidate = 600;
export const metadata = { title: "Kongre İşlemleri" };

type Row = CongressTrade & { stocks: { name: string } | null };

export default async function CongressPage() {
  const trades = await q<Row>(
    "congress_trades",
    "select=*,stocks(name)&order=disclosure_date.desc&limit=150",
    600
  );

  // en aktif politikacılar (son 90 gün)
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const t of trades) {
    if ((t.transaction_date ?? "") < cutoff) continue;
    counts.set(t.politician, (counts.get(t.politician) ?? 0) + 1);
  }
  const active = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <SectionTitle sub="ABD Kongre üyelerinin STOCK Act kapsamında bildirdiği hisse işlemleri (bildirim 45 güne kadar gecikebilir)">
        Kongre İşlemleri
      </SectionTitle>
      <div className="space-y-4">
        {active.length > 0 && (
          <Panel title="En Aktif Üyeler — Son 90 Gün">
            <div className="grid grid-cols-2 gap-px bg-edge sm:grid-cols-3">
              {active.map(([name, n]) => (
                <div key={name} className="bg-panel px-4 py-3">
                  <div className="truncate text-[13px] font-medium">{name}</div>
                  <div className="tnum mt-0.5 text-[11px] text-mut">{n} işlem</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <Panel title="İşlem Akışı">
          {trades.length === 0 ? (
            <Empty text="Kongre verisi bekleniyor — günlük ingestion sonrası dolar." />
          ) : (
            <div className="divide-y divide-edge/50">
              {trades.map((t) => (
                <Link key={t.id} href={t.symbol ? `/stock/${t.symbol}` : "#"} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2">
                  <span className="tnum w-14 shrink-0 text-[13px] font-semibold">{t.symbol ?? "—"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px]">{t.politician}</div>
                    <div className="text-[11px] text-dim">
                      {t.chamber === "senate" ? "Senato" : "Temsilciler Meclisi"}
                      {t.party ? ` · ${t.party}` : ""} · işlem {fmtDate(t.transaction_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[12px] font-semibold ${t.transaction_type === "buy" ? "text-up" : "text-down"}`}>
                      {t.transaction_type === "buy" ? "ALIŞ" : "SATIŞ"}
                    </div>
                    <div className="tnum text-[11px] text-mut">{t.amount_range ?? "—"}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
