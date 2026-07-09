import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Search from "@/components/Search";
import Freshness from "@/components/Freshness";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], display: "swap" });
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "RADAR·500", template: "%s · RADAR·500" },
  description: "S&P 500 takip ve sinyal paneli — fiyat, insider, balina, kongre, haber",
};

export const viewport: Viewport = { themeColor: "#07080b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header className="sticky top-0 z-40 border-b border-edge bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <Link href="/" className="flex shrink-0 items-baseline gap-0.5 select-none">
              <span className="text-[17px] font-bold tracking-tight">RADAR</span>
              <span className="tnum text-[17px] font-semibold text-amber">·500</span>
            </Link>
            <div className="min-w-0 flex-1">
              <Search />
            </div>
            <Freshness />
          </div>
          <Nav />
        </header>
        <main className="mx-auto max-w-6xl px-4 pt-5 pb-16">{children}</main>
        <footer className="border-t border-edge py-6">
          <p className="mx-auto max-w-6xl px-4 text-[11px] leading-relaxed text-dim">
            Veriler 15 dk gecikmeli olabilir. Bu sitedeki hiçbir içerik yatırım tavsiyesi değildir;
            skorlar yalnızca kamuya açık verilerin bilgilendirme amaçlı özetidir.
          </p>
        </footer>
      </body>
    </html>
  );
}
