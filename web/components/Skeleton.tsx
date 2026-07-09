export default function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-edge bg-panel" style={{ height: 120 + (i % 2) * 60 }} />
      ))}
    </div>
  );
}
