import { GuildShell } from '@/components/GuildShell';
import { Badge, Card, EmptyState } from '@/components/ui';
import { requireGuildAccess } from '@/lib/guilds';
import { GuildSettingsForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function GuildSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await requireGuildAccess(guildId);
  const guild = access.setting;

  return (
    <GuildShell access={access} description="Perilaku bot di server ini.">
      {!guild ? (
        <EmptyState>Setting tersedia setelah bot dipasang dan bergabung ke server ini.</EmptyState>
      ) : (
        <Card
          title="Setting bot"
          action={<Badge tone={guild.mode === 'off' ? 'neutral' : 'brand'}>{guild.mode}</Badge>}
        >
          <GuildSettingsForm
            guild={{
              guildId: guild.guildId,
              mode: guild.mode,
              scanUrls: guild.scanUrls,
              scanImages: guild.scanImages,
              useSafeBrowsing: guild.useSafeBrowsing,
              logCleanMessages: guild.logCleanMessages,
              heuristicMode: guild.heuristicMode,
              heuristicThreshold: guild.heuristicThreshold,
              useAiReview: guild.useAiReview,
              modLogChannelId: guild.modLogChannelId,
              reportChannelId: guild.reportChannelId,
              scannedChannelIds: guild.scannedChannelIds,
              ignoredChannelIds: guild.ignoredChannelIds,
              ignoredRoleIds: guild.ignoredRoleIds,
            }}
          />
        </Card>
      )}
    </GuildShell>
  );
}
