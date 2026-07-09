"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, AreaSeries, type IChartApi, ColorType } from "lightweight-charts";

type Bar = { date: string; close: number };
const RANGES = [
  { label: "1A", days: 30 },
  { label: "3A", days: 91 },
  { label: "6A", days: 182 },
  { label: "1Y", days: 365 },
] as const;

export default function PriceChart({ bars }: { bars: Bar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<number>(182);

  const data = useMemo(() => {
    const cutoff = new Date(Date.now() - range * 86400_000).toISOString().slice(0, 10);
    return bars.filter((b) => b.date >= cutoff).map((b) => ({ time: b.date, value: b.close }));
  }, [bars, range]);

  const up = data.length >= 2 && data[data.length - 1].value >= data[0].value;

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const color = up ? "#2bd48a" : "#f4485d";
    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#565d72",
        fontFamily: "var(--font-plex-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#13161d" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        horzLine: { color: "#2a3044", labelBackgroundColor: "#131722" },
        vertLine: { color: "#2a3044", labelBackgroundColor: "#131722" },
      },
      handleScroll: false,
      handleScale: false,
      height: 280,
      autoSize: true,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      lineWidth: 2,
      topColor: up ? "rgba(43,212,138,0.25)" : "rgba(244,72,93,0.25)",
      bottomColor: "rgba(0,0,0,0)",
      priceLineVisible: false,
    });
    series.setData(data);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => chart.remove();
  }, [data, up]);

  if (bars.length === 0) {
    return <div className="flex h-64 items-center justify-center text-[13px] text-dim">Fiyat geçmişi bekleniyor</div>;
  }

  return (
    <div>
      <div className="flex gap-1 px-4 pt-3">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r.days)}
            className={`tnum rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              range === r.days ? "bg-edge text-fg" : "text-dim hover:text-mut"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div ref={ref} className="h-[280px] w-full px-1" />
    </div>
  );
}
