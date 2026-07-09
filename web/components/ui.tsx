import Link from "next/link";
import { fmtPct, fmtPrice } from "@/lib/format";

export function ChangePill({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-dim">—</span>;
  const up = value >= 0;
  return (
    <span
      className={`tnum inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium ${
        up ? "bg-updim text-up" : "bg-downdim text-down"
      }`}
    >
      {up ? "▲" : "▼"} {fmtPct(Math.abs(value), false)}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rise rounded-xl border border-edge bg-panel ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StockRow({
  symbol,
  name,
  price,
  changePct,
  right,
}: {
  symbol: string;
  name: string;
  price?: number | null;
  changePct?: number | null;
  right?: React.ReactNode;
}) {
  return (
    <Link
      href={`/stock/${symbol}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel2"
    >
      <div className="min-w-0 flex-1">
        <div className="tnum text-[13px] font-semibold">{symbol}</div>
        <div className="truncate text-[11px] text-dim">{name}</div>
      </div>
      {right ?? (
        <>
          {price != null && <div className="tnum text-[13px]">{fmtPrice(price)}</div>}
          <div className="w-20 text-right">
            <ChangePill value={changePct} />
          </div>
        </>
      )}
    </Link>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-dim">{text}</div>;
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="mt-0.5 text-[13px] text-mut">{sub}</p>}
    </div>
  );
}
