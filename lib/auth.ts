import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { adminUsers, dashboardUsers } from './db/schema';
import { seal } from './crypto';
import { authSecret, isOwner } from './owner';

export const SESSION_COOKIE = 'vsg_session';
export const STATE_COOKIE = 'vsg_oauth_state';
export const INSTALL_STATE_COOKIE = 'vsg_install_state';
export const LOGIN_CALLBACK_PATH = '/api/auth/callback';
export const INSTALL_CALLBACK_PATH = '/api/install/callback';
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari

/**
 * Izin bot saat dipasang: View Channels (1<<10), Send Messages (1<<11),
 * Manage Messages (1<<13), Embed Links (1<<14), Read Message History (1<<16).
 */
export const BOT_PERMISSIONS = String((1 << 10) | (1 << 11) | (1 << 13) | (1 << 14) | (1 << 16));

/** Role staf Voler Scam Guard (tabel admin_users). */
export type Role = 'owner' | 'admin' | 'moderator';

const ROLE_RANK: Record<Role, number> = { moderator: 1, admin: 2, owner: 3 };

/** Isi cookie sesi: identitas saja. */
export interface SessionIdentity {
  discordId: string;
  username: string;
  avatar: string | null;
}

export interface Session extends SessionIdentity {
  /**
   * Selalu `owner`: hanya BOT_OWNER_IDS yang bisa punya sesi. Tipe `Role | null`
   * dipertahankan supaya pemeriksaan role di halaman dan action tetap berlaku.
   */
  role: Role | null;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum diset`);
  return value;
}

export function authConfig() {
  return {
    clientId: requiredEnv('DISCORD_CLIENT_ID'),
    clientSecret: requiredEnv('DISCORD_CLIENT_SECRET'),
    baseUrl: requiredEnv('DASHBOARD_URL').replace(/\/$/, ''),
    secret: authSecret(),
  };
}

/**
 * Flag `secure` cookie sesi. Diturunkan dari skema DASHBOARD_URL, bukan
 * NODE_ENV: image production bisa dilayani lewat http://host:9001 (tanpa
 * reverse proxy TLS), dan cookie Secure tidak akan pernah dikirim balik oleh
 * browser di HTTP polos — login jadi gagal tanpa pesan error.
 */
export function cookieSecure(): boolean {
  return authConfig().baseUrl.startsWith('https://');
}

export function secretKey(): Uint8Array {
  return new TextEncoder().encode(authSecret());
}

export function redirectUri(path: string = LOGIN_CALLBACK_PATH): string {
  return `${authConfig().baseUrl}${path}`;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: authConfig().clientId,
    redirect_uri: redirectUri(LOGIN_CALLBACK_PATH),
    response_type: 'code',
    // `guilds` dipakai untuk menampilkan server yang boleh dikelola user.
    scope: 'identify guilds',
    state,
    prompt: 'none',
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * URL pemasangan bot ke satu server. Server sudah dikunci (`guild_id` +
 * `disable_guild_select`), dan Discord mengarahkan balik ke dashboard dengan
 * `code`. Kalau "Requires OAuth2 Code Grant" aktif di Developer Portal, bot
 * baru benar-benar masuk setelah dashboard menukar code itu.
 */
export function installUrl(state: string, guildId: string): string {
  const params = new URLSearchParams({
    client_id: authConfig().clientId,
    scope: 'bot',
    permissions: BOT_PERMISSIONS,
    guild_id: guildId,
    disable_guild_select: 'true',
    integration_type: '0',
    response_type: 'code',
    redirect_uri: redirectUri(INSTALL_CALLBACK_PATH),
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  /** Ada kalau scope-nya memuat `bot`: server tempat bot dipasang. */
  guild?: { id: string; name: string };
}

export async function exchangeCode(
  code: string,
  callbackPath: string = LOGIN_CALLBACK_PATH,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = authConfig();
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(callbackPath),
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Token exchange gagal: HTTP ${res.status}`);
  }
  const json = (await res.json()) as Partial<TokenResponse>;
  if (!json.access_token) throw new Error('Response Discord tidak berisi access_token');
  return {
    access_token: json.access_token,
    expires_in: Number(json.expires_in) || MAX_SESSION_TTL_SECONDS,
    scope: json.scope ?? '',
    guild: json.guild,
  };
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Gagal mengambil profil Discord: HTTP ${res.status}`);
  return (await res.json()) as DiscordUser;
}

export function displayName(user: DiscordUser): string {
  return user.global_name || user.username;
}

/**
 * Catat profil pemilik di admin_users saat login. Kolom `added_by` / `reviewed_by`
 * di tabel lain berisi Discord ID, jadi baris ini membuat nama pemiliknya terbaca.
 */
export async function syncOwnerProfile(user: DiscordUser): Promise<void> {
  const username = displayName(user);
  await db
    .insert(adminUsers)
    .values({ discordId: user.id, username, avatar: user.avatar, role: 'owner', lastLogin: new Date() })
    .onConflictDoUpdate({
      target: adminUsers.discordId,
      set: { username, avatar: user.avatar, role: 'owner', lastLogin: new Date() },
    });
}

/** Simpan user dashboard beserta access token terenkripsi untuk refresh daftar server. */
export async function saveDashboardUser(user: DiscordUser, token: TokenResponse): Promise<void> {
  const values = {
    username: displayName(user),
    avatar: user.avatar,
    accessTokenEnc: seal(token.access_token),
    tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    lastLogin: new Date(),
  };
  await db
    .insert(dashboardUsers)
    .values({ discordId: user.id, ...values })
    .onConflictDoUpdate({ target: dashboardUsers.discordId, set: values });
}

/** Lupakan access token saat logout; sesi lama langsung diminta login ulang. */
export async function forgetDiscordToken(discordId: string): Promise<void> {
  await db
    .update(dashboardUsers)
    .set({ accessTokenEnc: null, tokenExpiresAt: null, guildsRefreshedAt: null })
    .where(eq(dashboardUsers.discordId, discordId));
}

/** Sesi tidak boleh hidup lebih lama dari access token yang menopangnya. */
export function sessionTtlSeconds(token: TokenResponse): number {
  return Math.max(60, Math.min(MAX_SESSION_TTL_SECONDS, token.expires_in - 60));
}

export async function createSessionToken(
  identity: SessionIdentity,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ ...identity })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.discordId !== 'string') return null;
    return {
      discordId: payload.discordId,
      username: String(payload.username ?? 'unknown'),
      avatar: (payload.avatar as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Di-cache per request supaya layout, page, dan action tidak query berulang. */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const identity = await verifySessionToken(token);
  // Dicek ulang tiap request: ID yang dihapus dari BOT_OWNER_IDS langsung kehilangan akses.
  if (!identity || !isOwner(identity.discordId)) return null;
  return { ...identity, role: 'owner' };
});

/** Dipakai di page/server action: paksa login sebelum melanjutkan. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export function hasRole(session: Session, minimum: Role): boolean {
  return session.role !== null && ROLE_RANK[session.role] >= ROLE_RANK[minimum];
}

/** Untuk server action yang mengubah data global (blacklist, whitelist global, admin). */
export async function requireRole(minimum: Role): Promise<Session> {
  const session = await requireSession();
  if (!hasRole(session, minimum)) {
    throw new Error(`Butuh role ${minimum} atau lebih tinggi untuk aksi ini.`);
  }
  return session;
}

/** Untuk halaman global: user non-staf dikembalikan ke daftar server. */
export async function requireStaffPage(): Promise<Session> {
  const session = await requireSession();
  if (!session.role) redirect('/');
  return session;
}

export function avatarUrl(session: SessionIdentity): string {
  if (!session.avatar) {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(session.discordId) >> 22n) % 6}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${session.discordId}/${session.avatar}.png?size=64`;
}
