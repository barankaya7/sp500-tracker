"use client";

import Link from "next/link";
import { cq, useData } from "@/lib/client";
import { type NewsItem } from "@/lib/db";
import Skeleton from "@/components/Skeleton";
import { fmtDateTime } from "@/lib/format";
import { Panel, SectionTitle, Empty } from "@/components/ui";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function NewsClient() {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Inner />
    </Suspense>
  );
}


function Inner() {
  const sp = useSearchParams();
  const symbol = sp.get("symbol");
  const { data: news, loading } = useData(() => {
    const filter = symbol ? `&symbol=eq.${symbol.toUpperCase()}` : "";
    return cq<NewsItem>("news", `select=*&order=published_at.desc&limit=100${filter}`);
  }, [symbol]);
  if (loading || !news) return <Skeleton rows={3} />;

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
