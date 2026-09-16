'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { guildSettings } from '@/lib/db/schema';
import { requireGuildAccess } from '@/lib/guilds';

export interface ActionState {
  ok?: string;
  error?: string;
}

const MODES = ['auto_delete', 'warn_delete', 'warn', 'flag_only', 'off'];
const HEURISTIC_MODES = ['off', 'images', 'all'];

/** "111, 222 333" -> ["111","222","333"] */
function parseIds(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{5,25}$/.test(s));
}

function parseChannelId(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return /^\d{5,25}$/.test(raw) ? raw : null;
}

export async function updateGuildSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // guildId datang dari form: cek akses sebelum menyentuh database.
  const { guildId, setting } = await requireGuildAccess(String(formData.get('guildId') ?? '').trim());
  if (!setting) return { error: 'Bot belum pernah bergabung ke server ini.' };

  const mode = String(formData.get('mode') ?? 'flag_only');
  if (!MODES.includes(mode)) return { error: 'Mode tidak dikenal.' };

  const heuristicMode = String(formData.get('heuristicMode') ?? 'images');
  if (!HEURISTIC_MODES.includes(heuristicMode)) return { error: 'Mode heuristik tidak dikenal.' };

  const heuristicThreshold = Number(formData.get('heuristicThreshold') ?? 8);
  if (!Number.isInteger(heuristicThreshold) || heuristicThreshold < 3 || heuristicThreshold > 30) {
    return { error: 'Ambang heuristik harus bilangan bulat 3–30.' };
  }

  const modLogRaw = String(formData.get('modLogChannelId') ?? '').trim();
  const reportRaw = String(formData.get('reportChannelId') ?? '').trim();
  if (modLogRaw && !parseChannelId(modLogRaw)) return { error: 'Mod-log channel ID tidak valid.' };
  if (reportRaw && !parseChannelId(reportRaw)) return { error: 'Report channel ID tidak valid.' };

  await db
    .update(guildSettings)
    .set({
      mode,
      scanUrls: formData.get('scanUrls') === 'on',
      scanImages: formData.get('scanImages') === 'on',
      useSafeBrowsing: formData.get('useSafeBrowsing') === 'on',
      logCleanMessages: formData.get('logCleanMessages') === 'on',
      heuristicMode,
      heuristicThreshold,
      useAiReview: formData.get('useAiReview') === 'on',
      modLogChannelId: parseChannelId(modLogRaw),
      reportChannelId: parseChannelId(reportRaw),
      scannedChannelIds: parseIds(formData.get('scannedChannelIds')),
      ignoredChannelIds: parseIds(formData.get('ignoredChannelIds')),
      ignoredRoleIds: parseIds(formData.get('ignoredRoleIds')),
      updatedAt: new Date(),
    })
    .where(eq(guildSettings.guildId, guildId));

  revalidatePath(`/servers/${guildId}`, 'layout');
  return { ok: 'Setting tersimpan. Bot menerapkan perubahan dalam ≤30 detik.' };
}
