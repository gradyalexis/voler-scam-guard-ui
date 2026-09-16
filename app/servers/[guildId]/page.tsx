import { GuildShell } from '@/components/GuildShell';
import { OverviewCharts } from '@/components/OverviewCharts';
import { Stat } from '@/components/ui';
import { requireGuildAccess } from '@/lib/guilds';
import {
  getDailyDetections,
  getDetectionStats,
  getGuildWhitelistCount,
  getTopMatches,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function GuildOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ installed?: string }>;
}) {
  const { guildId } = await params;
  const { installed } = await searchParams;
  const access = await requireGuildAccess(guildId);

  const [stats, daily, top, whitelistCount] = await Promise.all([
    getDetectionStats(guildId),
    getDailyDetections(14, guildId),
    getTopMatches(8, guildId),
    getGuildWhitelistCount(guildId),
  ]);

  return (
    <GuildShell
      access={access}
      description="Aktivitas deteksi bot di server ini."
      installed={installed === '1'}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Deteksi 24 jam" value={stats.last24h} />
        <Stat label="Deteksi 7 hari" value={stats.last7d} hint={`${stats.deleted7d} pesan dihapus`} />
        <Stat
          label="User kena flag (7h)"
          value={stats.uniqueUsers7d}
          hint="user unik dengan deteksi"
        />
        <Stat
          label="Mode bot"
          value={access.setting?.mode ?? '—'}
          hint={`${whitelistCount} domain di whitelist server`}
        />
      </div>

      <div className="mt-6">
        <OverviewCharts daily={daily} top={top} logsPath={`/servers/${guildId}/logs`} />
      </div>
    </GuildShell>
  );
}
