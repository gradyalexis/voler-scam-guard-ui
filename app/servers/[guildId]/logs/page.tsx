import { GuildShell } from '@/components/GuildShell';
import { LogsView, logFiltersFromParams, type LogSearchParams } from '@/components/LogsView';
import { requireGuildAccess } from '@/lib/guilds';
import { getLogs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function GuildLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<LogSearchParams>;
}) {
  const { guildId } = await params;
  const access = await requireGuildAccess(guildId);
  const query = await searchParams;

  // guildId selalu dari URL yang sudah dicek aksesnya, bukan dari query string.
  const result = await getLogs({ ...logFiltersFromParams(query), guildId });

  return (
    <GuildShell
      access={access}
      description={`${result.total.toLocaleString('id-ID')} log deteksi di server ini cocok dengan filter.`}
    >
      <LogsView
        params={query}
        basePath={`/servers/${guildId}/logs`}
        result={result}
        guildOptions={null}
      />
    </GuildShell>
  );
}
