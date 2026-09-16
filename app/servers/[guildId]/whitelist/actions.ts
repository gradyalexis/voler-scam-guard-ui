'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { guildWhitelistDomains } from '@/lib/db/schema';
import { requireGuildAccess } from '@/lib/guilds';
import { isValidDomain, normalizeDomain } from '@/lib/normalize';

export interface ActionState {
  ok?: string;
  error?: string;
}

export async function addGuildWhitelistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { session, guildId } = await requireGuildAccess(String(formData.get('guildId') ?? ''));
  const domain = normalizeDomain(String(formData.get('domain') ?? ''));
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!isValidDomain(domain)) return { error: 'Domain tidak valid.' };

  const inserted = await db
    .insert(guildWhitelistDomains)
    .values({ guildId, domain, note, addedBy: session.discordId })
    .onConflictDoNothing({ target: [guildWhitelistDomains.guildId, guildWhitelistDomains.domain] })
    .returning({ id: guildWhitelistDomains.id });

  revalidatePath(`/servers/${guildId}/whitelist`);
  return inserted.length > 0
    ? { ok: `${domain} ditambahkan ke whitelist server ini. Berlaku di bot dalam ≤60 detik.` }
    : { error: `${domain} sudah ada di whitelist server ini.` };
}

export async function removeGuildWhitelistAction(formData: FormData): Promise<void> {
  const { guildId } = await requireGuildAccess(String(formData.get('guildId') ?? ''));
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  // Filter guild_id juga, supaya id milik server lain tidak bisa dihapus.
  await db
    .delete(guildWhitelistDomains)
    .where(and(eq(guildWhitelistDomains.id, id), eq(guildWhitelistDomains.guildId, guildId)));
  revalidatePath(`/servers/${guildId}/whitelist`);
}
