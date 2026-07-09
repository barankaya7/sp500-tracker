import { q, type Stock } from "@/lib/db";
import StockClient from "@/components/pages/StockClient";

export const dynamicParams = false;

export async function generateStaticParams() {
  const stocks = await q<Stock>("stocks", "select=symbol&order=symbol", 0);
  if (stocks.length === 0) {
    // build sırasında DB'ye erişilemezse en azından örnek yol üret
    return [{ symbol: "AAPL" }];
  }
  return stocks.map((s) => ({ symbol: s.symbol }));
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <StockClient symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
