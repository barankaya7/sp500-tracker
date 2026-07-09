"use client";

import { cq, useData } from "@/lib/client";
import { relTime } from "@/lib/format";

type JobRun = { last_run: string | null };

export default function Freshness() {
  const { data } = useData(() => cq<JobRun>("job_runs", "select=last_run&job=eq.quotes"), []);
  const last = data?.[0]?.last_run ?? null;
  return (
    <div className="hidden shrink-0 items-center gap-1.5 sm:flex" title="Son veri güncellemesi">
      <span className={`live-dot h-1.5 w-1.5 rounded-full ${last ? "bg-up" : "bg-dim"}`} />
      <span className="text-[11px] text-mut">{last ? relTime(last) : "veri bekleniyor"}</span>
    </div>
  );
}
