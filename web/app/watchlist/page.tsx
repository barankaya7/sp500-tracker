import { SectionTitle } from "@/components/ui";
import WatchlistClient from "@/components/WatchlistClient";

export const metadata = { title: "İzleme Listesi" };

export default function WatchlistPage() {
  return (
    <div>
      <SectionTitle sub="Listen bu tarayıcıda saklanır — hisse sayfasındaki ★ ile ekle">İzleme Listesi</SectionTitle>
      <WatchlistClient />
    </div>
  );
}
