'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { markGuildsStale } from '@/lib/guilds';

/** Tombol "Muat ulang daftar": ambil ulang server dari Discord tanpa menunggu 5 menit. */
export async function refreshGuildListAction(): Promise<void> {
  const session = await requireSession();
  await markGuildsStale(session.discordId);
  revalidatePath('/');
}
