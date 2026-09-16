import { LogsView, logFiltersFromParams, type LogSearchParams } from '@/components/LogsView';
import { Shell } from '@/components/Shell';
import { requireStaffPage } from '@/lib/auth';
import { getGuildOptions, getLogs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function GlobalLogsPage({
  searchParams,
}: {
  searchParams: Promise<LogSearchParams>;
}) {
  const session = await requireStaffPage();
  const params = await searchParams;

  const [result, guilds] = await Promise.all([
    getLogs(logFiltersFromParams(params)),
    getGuildOptions(),
  ]);

  return (
    <Shell
      session={session}
      title="Logs global"
      description={`${result.total.toLocaleString('id-ID')} baris cocok dengan filter, dari semua server.`}
    >
      <LogsView params={params} basePath="/logs" result={result} guildOptions={guilds} />
    </Shell>
  );
}
