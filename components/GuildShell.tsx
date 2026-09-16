import { GuildTabs } from './GuildTabs';
import { InstallPrompt } from './InstallPrompt';
import { Shell } from './Shell';
import { guildDisplayName, type GuildAccess } from '@/lib/guilds';

/** Shell untuk halaman /servers/[guildId]/*: nama server, tab, dan peringatan kalau bot tidak ada. */
export function GuildShell({
  access,
  description,
  installed,
  children,
}: {
  access: GuildAccess;
  description?: string;
  /** true setelah kembali dari alur pasang bot. */
  installed?: boolean;
  children: React.ReactNode;
}) {
  const botPresent = access.setting?.botPresent ?? false;

  return (
    <Shell
      session={access.session}
      title={guildDisplayName(access)}
      description={description}
      subnav={<GuildTabs guildId={access.guildId} />}
    >
      {!botPresent && (
        <div className="mb-4">
          <InstallPrompt
            guildId={access.guildId}
            canInstall={access.discordGuild !== null}
            wasInstalled={access.setting !== null}
            justInstalled={Boolean(installed)}
          />
        </div>
      )}
      {children}
    </Shell>
  );
}
