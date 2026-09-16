import { NextResponse, type NextRequest } from 'next/server';
import {
  authConfig,
  exchangeCode,
  getSession,
  INSTALL_CALLBACK_PATH,
  INSTALL_STATE_COOKIE,
} from '@/lib/auth';
import { isValidGuildId, recordInstall } from '@/lib/guilds';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const base = authConfig().baseUrl;
  const url = new URL(request.url);
  const [expectedState, expectedGuild] = (
    request.cookies.get(INSTALL_STATE_COOKIE)?.value ?? ''
  ).split(':');

  const finish = (path: string) => {
    const response = NextResponse.redirect(`${base}${path}`);
    response.cookies.delete({ name: INSTALL_STATE_COOKIE, path: '/api/install' });
    return response;
  };

  const session = await getSession();
  if (!session) return finish('/login');

  if (url.searchParams.get('error')) {
    return finish(expectedGuild ? `/servers/${expectedGuild}?install=denied` : '/?install=denied');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // Proteksi CSRF, sama seperti callback login.
  if (!code || !state || !expectedState || state !== expectedState) {
    return finish('/?install=bad_state');
  }

  try {
    // Dengan "Requires OAuth2 Code Grant" aktif, penukaran code inilah yang
    // benar-benar memasukkan bot ke server.
    const token = await exchangeCode(code, INSTALL_CALLBACK_PATH);
    const guildId = token.guild?.id ?? expectedGuild;
    if (!guildId || !isValidGuildId(guildId)) return finish('/?install=error');

    await recordInstall(guildId, session.discordId);
    return finish(`/servers/${guildId}?installed=1`);
  } catch (err) {
    console.error('[install] callback gagal', err);
    return finish('/?install=error');
  }
}
