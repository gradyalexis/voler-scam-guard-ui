import Link from 'next/link';
import { GuildShell } from '@/components/GuildShell';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, EmptyState, Input } from '@/components/ui';
import { requireGuildAccess } from '@/lib/guilds';
import { getGuildWhitelistDomains } from '@/lib/queries';
import { removeGuildWhitelistAction } from './actions';
import { AddGuildWhitelistForm } from './form';

export const dynamic = 'force-dynamic';

export default async function GuildWhitelistPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { guildId } = await params;
  const access = await requireGuildAccess(guildId);
  const { q } = await searchParams;
  const rows = await getGuildWhitelistDomains(guildId, q);
  const basePath = `/servers/${guildId}/whitelist`;

  return (
    <GuildShell
      access={access}
      description="Domain di sini dilewati scanner di server ini saja — tidak dicek blacklist maupun Safe Browsing. Whitelist global dari staf tetap berlaku."
    >
      <Card title="Tambah domain terpercaya" className="mb-4">
        <AddGuildWhitelistForm guildId={guildId} />
      </Card>

      <Card
        title={`${rows.length} domain terpercaya`}
        action={
          <form method="get" className="flex gap-2">
            <Input name="q" defaultValue={q ?? ''} placeholder="Cari…" className="h-8 py-1" />
            <button
              type="submit"
              className="rounded-lg bg-ink-700 px-3 py-1 text-xs text-ink-200 hover:bg-ink-600"
            >
              Cari
            </button>
            {q && (
              <Link
                href={basePath}
                className="rounded-lg bg-ink-700 px-3 py-1 text-xs text-ink-200 hover:bg-ink-600"
              >
                Reset
              </Link>
            )}
          </form>
        }
      >
        {rows.length === 0 ? (
          <EmptyState>Belum ada domain di whitelist server ini.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Catatan</th>
                  <th className="px-3 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-xs text-ok-500">{row.domain}</td>
                    <td className="px-3 py-2 text-xs text-ink-200">{row.note ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <form action={removeGuildWhitelistAction}>
                          <input type="hidden" name="guildId" value={guildId} />
                          <input type="hidden" name="id" value={row.id} />
                          <SubmitButton variant="danger">Hapus</SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </GuildShell>
  );
}
