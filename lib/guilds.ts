import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from './db';
import {
  dashboardUserGuilds,
  dashboardUsers,
  guildInstalls,
  guildSettings,
  type GuildSetting,
} from './db/schema';
import { requireSession, type Session } from './auth';
import { unseal } from './crypto';

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

/**
 * Daftar server user diambil ulang dari Discord paling cepat tiap 5 menit.
 * Ini juga batas waktu sampai izin yang dicabut di Discord ikut berlaku di sini.
 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface ManageableGuild {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  isOwner: boolean;
}

class DiscordAuthError extends Error {}

export function isValidGuildId(id: string): boolean {
  return /^\d{15,25}$/.test(id);
}

/** Sama dengan syarat Discord untuk menambahkan bot: owner, Administrator, atau Manage Server. */
export function canManageGuild(guild: DiscordGuild): boolean {
  if (guild.owner) return true;
  try {
    const perms = BigInt(guild.permissions);
    return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
  } catch {
    return false;
  }
}

export function guildIconUrl(guildId: string, icon: string | null): string | null {
  return icon ? `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=64` : null;
}

export async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new DiscordAuthError('Access token Discord sudah tidak berlaku');
  if (!res.ok) throw new Error(`Gagal mengambil daftar server Discord: HTTP ${res.status}`);
  return (await res.json()) as DiscordGuild[];
}

/** Ganti daftar server yang boleh dikelola user dengan hasil terbaru dari Discord. */
export async function storeManageableGuilds(
  discordId: string,
  guilds: DiscordGuild[],
): Promise<void> {
  const rows = guilds.filter(canManageGuild).map((g) => ({
    discordId,
    guildId: g.id,
    guildName: g.name,
    guildIcon: g.icon,
    isOwner: g.owner,
  }));

  await db.transaction(async (tx) => {
    // Kunci baris user supaya dua refresh bersamaan tidak saling menimpa.
    await tx
      .select({ discordId: dashboardUsers.discordId })
      .from(dashboardUsers)
      .where(eq(dashboardUsers.discordId, discordId))
      .for('update');
    await tx.delete(dashboardUserGuilds).where(eq(dashboardUserGuilds.discordId, discordId));
    if (rows.length > 0) await tx.insert(dashboardUserGuilds).values(rows);
    await tx
      .update(dashboardUsers)
      .set({ guildsRefreshedAt: new Date() })
      .where(eq(dashboardUsers.discordId, discordId));
  });
}

/** Paksa daftar server diambil ulang dari Discord pada request berikutnya. */
export async function markGuildsStale(discordId: string): Promise<void> {
  await db
    .update(dashboardUsers)
    .set({ guildsRefreshedAt: null })
    .where(eq(dashboardUsers.discordId, discordId));
}

/**
 * Server yang boleh dikelola user, disegarkan dari Discord kalau sudah basi.
 * null = access token tidak ada / kedaluwarsa / dicabut → user harus login ulang.
 */
export const getManageableGuilds = cache(
  async (discordId: string): Promise<ManageableGuild[] | null> => {
    const [user] = await db
      .select()
      .from(dashboardUsers)
      .where(eq(dashboardUsers.discordId, discordId))
      .limit(1);
    if (!user) return null;

    const refreshedAt = user.guildsRefreshedAt?.getTime() ?? 0;
    if (Date.now() - refreshedAt >= REFRESH_INTERVAL_MS) {
      const token = user.accessTokenEnc ? unseal(user.accessTokenEnc) : null;
      const expired = !user.tokenExpiresAt || user.tokenExpiresAt.getTime() <= Date.now();
      if (!token || expired) return null;

      try {
        await storeManageableGuilds(discordId, await fetchDiscordGuilds(token));
      } catch (err) {
        if (err instanceof DiscordAuthError) return null;
        // Rate limit atau Discord sedang gangguan: pakai daftar terakhir.
        console.error('[guilds] refresh daftar server gagal, memakai data tersimpan', err);
      }
    }

    return db
      .select({
        guildId: dashboardUserGuilds.guildId,
        guildName: dashboardUserGuilds.guildName,
        guildIcon: dashboardUserGuilds.guildIcon,
        isOwner: dashboardUserGuilds.isOwner,
      })
      .from(dashboardUserGuilds)
      .where(eq(dashboardUserGuilds.discordId, discordId))
      .orderBy(dashboardUserGuilds.guildName);
  },
);

/** Versi untuk page/action: arahkan ke login ulang kalau token Discord sudah tidak berlaku. */
export async function requireManageableGuilds(session: Session): Promise<ManageableGuild[]> {
  const guilds = await getManageableGuilds(session.discordId);
  if (!guilds) redirect('/login?error=expired');
  return guilds;
}

export interface GuildAccess {
  session: Session;
  guildId: string;
  /** Baris guild_settings; null kalau bot belum pernah masuk server ini. */
  setting: GuildSetting | null;
  /** Data server dari Discord; null untuk staf yang bukan admin server itu. */
  discordGuild: ManageableGuild | null;
}

/**
 * Pastikan user boleh mengelola server ini. Staf boleh semua server; user biasa
 * hanya server tempat dia owner / Administrator / Manage Server menurut Discord.
 *
 * WAJIB dipanggil di setiap page DAN server action yang menerima guildId —
 * jangan pernah percaya guildId dari URL atau form tanpa lewat fungsi ini.
 */
export const requireGuildAccess = cache(async (guildId: string): Promise<GuildAccess> => {
  const session = await requireSession();
  if (!isValidGuildId(guildId)) notFound();

  let discordGuild: ManageableGuild | null = null;
  if (session.role) {
    // Staf tidak butuh izin Discord, tapi tombol pasang bot hanya muncul kalau dia admin server itu.
    const guilds = await getManageableGuilds(session.discordId);
    discordGuild = guilds?.find((g) => g.guildId === guildId) ?? null;
  } else {
    const guilds = await requireManageableGuilds(session);
    discordGuild = guilds.find((g) => g.guildId === guildId) ?? null;
    if (!discordGuild) notFound();
  }

  const [setting] = await db
    .select()
    .from(guildSettings)
    .where(eq(guildSettings.guildId, guildId))
    .limit(1);

  return { session, guildId, setting: setting ?? null, discordGuild };
});

export function guildDisplayName(access: GuildAccess): string {
  return access.setting?.guildName ?? access.discordGuild?.guildName ?? access.guildId;
}

export async function recordInstall(guildId: string, installedBy: string): Promise<void> {
  await db.insert(guildInstalls).values({ guildId, installedBy });
  // Status admin di server baru bisa berubah; ambil ulang daftar server berikutnya.
  await markGuildsStale(installedBy);
}
