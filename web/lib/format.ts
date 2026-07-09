export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(v: number | null | undefined, signed = true): string {
  if (v == null) return "—";
  const s = signed && v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

export function fmtCap(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
  return "$" + v.toLocaleString("en-US");
}

export function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(digits) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(digits) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(digits) + "K";
  return v.toFixed(digits);
}

export function fmtRatio(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${AY[d.getMonth()]} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export const RATING_TR: Record<string, string> = {
  strong_buy: "Güçlü Al", strongBuy: "Güçlü Al", buy: "Al", hold: "Tut",
  sell: "Sat", strong_sell: "Güçlü Sat", underperform: "Zayıf", none: "—",
};
