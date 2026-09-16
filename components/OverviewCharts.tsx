import Link from 'next/link';
import { Badge, Card, EmptyState } from './ui';

export function OverviewCharts({
  daily,
  top,
  logsPath,
}: {
  daily: { day: string; total: number }[];
  top: { matched_value: string; detection_type: string; total: number }[];
  /** Halaman log tujuan link "lihat semua" — global atau per server. */
  logsPath: string;
}) {
  const peak = Math.max(1, ...daily.map((d) => d.total));

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Deteksi 14 hari terakhir" className="lg:col-span-3">
        {daily.every((d) => d.total === 0) ? (
          <EmptyState>Belum ada deteksi tercatat.</EmptyState>
        ) : (
          <div className="flex h-44 items-end gap-1.5">
            {daily.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-brand-500/70 transition group-hover:bg-brand-400"
                    style={{ height: `${Math.max(2, (d.total / peak) * 100)}%` }}
                    title={`${d.day}: ${d.total} deteksi`}
                  />
                </div>
                <span className="text-[10px] text-ink-400">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Top match (30 hari)"
        className="lg:col-span-2"
        action={
          <Link href={logsPath} className="text-xs text-brand-400 hover:underline">
            Lihat semua log
          </Link>
        }
      >
        {top.length === 0 ? (
          <EmptyState>Belum ada data.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {top.map((row) => (
              <li
                key={`${row.detection_type}:${row.matched_value}`}
                className="flex items-center justify-between gap-3"
              >
                <Link
                  href={`${logsPath}?q=${encodeURIComponent(row.matched_value)}`}
                  className="truncate font-mono text-xs text-ink-200 hover:text-brand-400"
                >
                  {row.matched_value}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone="brand">{row.detection_type}</Badge>
                  <span className="text-xs tabular-nums text-ink-400">{row.total}×</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
