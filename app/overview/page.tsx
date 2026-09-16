import { OverviewCharts } from '@/components/OverviewCharts';
import { Shell } from '@/components/Shell';
import { Stat } from '@/components/ui';
import { requireStaffPage } from '@/lib/auth';
import {
  getDailyDetections,
  getDatabaseStats,
  getDetectionStats,
  getTopMatches,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function GlobalOverviewPage() {
  const session = await requireStaffPage();
  const [stats, database, daily, top] = await Promise.all([
    getDetectionStats(),
    getDatabaseStats(),
    getDailyDetections(14),
    getTopMatches(8),
  ]);

  return (
    <Shell
      session={session}
      title="Ringkasan global"
      description="Aktivitas deteksi di semua server dan isi database blacklist. Khusus staf."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Deteksi 24 jam" value={stats.last24h} />
        <Stat label="Deteksi 7 hari" value={stats.last7d} hint={`${stats.deleted7d} pesan dihapus`} />
        <Stat label="Total deteksi" value={stats.total} />
        <Stat label="Server berisi bot" value={database.guilds} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Domain blacklist" value={database.domains} />
        <Stat label="Akun verified" value={database.accountsVerified} />
        <Stat
          label="Laporan pending"
          value={database.accountsPending}
          hint={database.accountsPending > 0 ? 'butuh review' : 'antrean kosong'}
        />
        <Stat label="Whitelist global" value={database.whitelist} />
      </div>

      <div className="mt-6">
        <OverviewCharts daily={daily} top={top} logsPath="/logs" />
      </div>
    </Shell>
  );
}
