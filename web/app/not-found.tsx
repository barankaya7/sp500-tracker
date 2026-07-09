import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="tnum text-5xl font-bold text-edge2">404</div>
      <p className="mt-3 text-[14px] text-mut">Aradığın sayfa veya sembol bulunamadı.</p>
      <Link href="/" className="mt-6 rounded-lg border border-edge bg-panel px-4 py-2 text-[13px] font-medium hover:border-edge2">
        Panele dön
      </Link>
    </div>
  );
}
