import { NextResponse, type NextRequest } from 'next/server';
import {
  authConfig,
  cookieSecure,
  createSessionToken,
  displayName,
  exchangeCode,
  fetchDiscordUser,
  saveDashboardUser,
  sessionTtlSeconds,
  SESSION_COOKIE,
  STATE_COOKIE,
  syncOwnerProfile,
} from '@/lib/auth';
import { fetchDiscordGuilds, storeManageableGuilds } from '@/lib/guilds';
import { isOwner } from '@/lib/owner';

export const dynamic = 'force-dynamic';

function loginError(base: string, code: string) {
  return NextResponse.redirect(`${base}/login?error=${code}`);
}

export async function GET(request: NextRequest) {
  const base = authConfig().baseUrl;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (url.searchParams.get('error')) return loginError(base, 'denied');
  if (!code || !state) return loginError(base, 'invalid_request');
  // Proteksi CSRF: state harus sama dengan yang dikirim saat memulai OAuth.
  if (!expectedState || expectedState !== state) return loginError(base, 'bad_state');

  try {
    const token = await exchangeCode(code);
    const [discordUser, guilds] = await Promise.all([
      fetchDiscordUser(token.access_token),
      fetchDiscordGuilds(token.access_token),
    ]);

    // Hanya pemilik instance bot ini (BOT_OWNER_IDS) yang boleh masuk. Dicek
    // sebelum menyimpan apa pun, jadi user lain tidak meninggalkan data.
    if (!isOwner(discordUser.id)) return loginError(base, 'not_allowed');

    await syncOwnerProfile(discordUser);
    await saveDashboardUser(discordUser, token);
    await storeManageableGuilds(discordUser.id, guilds);

    const ttl = sessionTtlSeconds(token);
    const sessionToken = await createSessionToken(
      { discordId: discordUser.id, username: displayName(discordUser), avatar: discordUser.avatar },
      ttl,
    );
    const response = NextResponse.redirect(`${base}/`);
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure(),
      path: '/',
      maxAge: ttl,
    });
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    console.error('[auth] callback gagal', err);
    return loginError(base, 'server_error');
  }
}
