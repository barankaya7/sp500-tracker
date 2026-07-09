import Link from "next/link";
import { q, type NewsItem } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Panel, SectionTitle, Empty } from "@/components/ui";

export const revalidate = 300;
export const metadata = { title: "Haberler" };

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  const filter = symbol ? `&symbol=eq.${symbol.toUpperCase()}` : "";
  const news = await q<NewsItem>("news", `select=*&order=published_at.desc&limit=100${filter}`, 300);

  return (
    <div>
      <SectionTitle sub={symbol ? `${symbol.toUpperCase()} haberleri` : "S&P 500 şirketleri haber akışı"}>
        Haberler
      </SectionTitle>
      {symbol && (
        <Link href="/news" className="mb-3 inline-block rounded-lg border border-edge bg-panel px-3 py-1 text-[12px] text-mut hover:text-fg">
          ✕ Filtreyi kaldır
        </Link>
      )}
      <Panel>
        {news.length === 0 ? (
          <Empty text="Haber verisi bekleniyor — haber ingestion sonrası dolar." />
        ) : (
          <div className="divide-y divide-edge/50">
            {news.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <a href={n.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block hover:text-amber">
                  <div className="text-[13px] font-medium leading-snug">{n.headline}</div>
                </a>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-dim">
                  {n.symbol && (
                    <Link href={`/stock/${n.symbol}`} className="tnum font-semibold text-amber hover:underline">
                      {n.symbol}
                    </Link>
                  )}
                  <span>{n.source}</span>
                  <span>·</span>
                  <span>{fmtDateTime(n.published_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
