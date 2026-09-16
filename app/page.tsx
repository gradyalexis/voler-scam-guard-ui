import Image from 'next/image';
import Link from 'next/link';
import { installHref } from '@/components/InstallPrompt';
import { Shell } from '@/components/Shell';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, EmptyState } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import type { GuildSetting } from '@/lib/db/schema';
import { guildIconUrl, requireManageableGuilds } from '@/lib/guilds';
import { getAllGuildSettings, getGuildSettingsByIds } from '@/lib/queries';
import { refreshGuildListAction } from './actions';

export const dynamic = 'force-dynamic';

const INSTALL_MESSAGES: Record<string, string> = {
  denied: 'Pemasangan bot dibatalkan di halaman Discord.',
  bad_state: 'State pemasangan tidak cocok. Ulangi dari tombol "Pasang bot".',
  forbidden: 'Kamu tidak punya izin Manage Server di server itu.',
  invalid: 'ID server tidak valid.',
  error: 'Gagal memproses pemasangan bot. Cek log dashboard.',
};

function GuildAvatar({ guildId, name, icon }: { guildId: string; name: string; icon: string | null }) {
  const src = guildIconUrl(guildId, icon);
  if (src) {
    return (
      <Image src={src} alt="" width={40} height={40} unoptimized className="rounded-xl border border-ink-700" />
    );
  }
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-700 text-sm font-semibold text-ink-200">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function StatusBadge({ setting }: { setting: GuildSetting | undefined }) {
  if (!setting) return <Badge>belum dipasang</Badge>;
  if (!setting.botPresent) return <Badge tone="warn">bot dikeluarkan</Badge>;
  return <Badge tone={setting.mode === 'off' ? 'neutral' : 'ok'}>aktif · {setting.mode}</Badge>;
}

export default async function ServerPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ install?: string }>;
}) {
  const session = await requireSession();
  const { install } = await searchParams;

  const guilds = await requireManageableGuilds(session);
  const [settings, allGuilds] = await Promise.all([
    getGuildSettingsByIds(guilds.map((g) => g.guildId)),
    session.role ? getAllGuildSettings() : Promise.resolve([]),
  ]);
  const settingById = new Map(settings.map((s) => [s.guildId, s]));

  return (
    <Shell
      session={session}
      title="Server saya"
      description="Server tempat kamu owner atau punya izin Manage Server. Pilih server untuk memasang atau mengatur bot."
    >
      {install && INSTALL_MESSAGES[install] && (
        <p className="mb-4 rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-danger-500">
          {INSTALL_MESSAGES[install]}
        </p>
      )}

      <Card
        title={`${guilds.length} server`}
        action={
          <form action={refreshGuildListAction}>
            <SubmitButton variant="ghost" pendingLabel="Memuat…">
              Muat ulang daftar
            </SubmitButton>
          </form>
        }
      >
        {guilds.length === 0 ? (
          <EmptyState>
            Tidak ada server tempat kamu punya izin Manage Server. Minta owner server memberimu
            izin itu, lalu klik &quot;Muat ulang daftar&quot;.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => {
              const setting = settingById.get(guild.guildId);
              const active = setting?.botPresent ?? false;
              return (
                <li
                  key={guild.guildId}
                  className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3"
                >
                  <GuildAvatar guildId={guild.guildId} name={guild.guildName} icon={guild.guildIcon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{guild.guildName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge setting={setting} />
                      {guild.isOwner && <span className="text-[11px] text-ink-400">owner</span>}
                    </div>
                  </div>
                  {active ? (
                    <Link
                      href={`/servers/${guild.guildId}`}
                      className="rounded-lg bg-ink-700 px-3 py-2 text-sm text-ink-200 hover:bg-ink-600"
                    >
                      Kelola
                    </Link>
                  ) : (
                    <a
                      href={installHref(guild.guildId)}
                      className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-400"
                    >
                      Pasang bot
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-ink-400">
          Daftar ini disegarkan dari Discord paling lama tiap 5 menit. Izin yang dicabut di Discord
          juga berlaku di sini setelah jeda itu.
        </p>
      </Card>

      {session.role && (
        <Card title={`Semua server berisi bot (staf) — ${allGuilds.length}`} className="mt-6">
          {allGuilds.length === 0 ? (
            <EmptyState>Belum ada server terdaftar.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Server</th>
                    <th className="px-3 py-2 font-medium">Guild ID</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {allGuilds.map((guild) => (
                    <tr key={guild.guildId}>
                      <td className="px-3 py-2 text-white">{guild.guildName ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-400">{guild.guildId}</td>
                      <td className="px-3 py-2">
                        <StatusBadge setting={guild} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/servers/${guild.guildId}`}
                          className="text-xs text-brand-400 hover:underline"
                        >
                          Buka
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </Shell>
  );
}
