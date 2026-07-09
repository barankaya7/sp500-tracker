"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Panel" },
  { href: "/screener", label: "Tarama" },
  { href: "/watchlist", label: "İzleme" },
  { href: "/whales", label: "Balinalar" },
  { href: "/insiders", label: "Insider" },
  { href: "/congress", label: "Kongre" },
  { href: "/news", label: "Haberler" },
  { href: "/earnings", label: "Bilançolar" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="mx-auto max-w-6xl overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="flex gap-1 pb-0">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`relative shrink-0 rounded-t-md px-3 py-2 text-[13px] font-medium transition-colors ${
                active ? "text-amber" : "text-mut hover:text-fg"
              }`}
            >
              {it.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-amber" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
