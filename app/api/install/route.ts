import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig, cookieSecure, getSession, INSTALL_STATE_COOKIE, installUrl } from '@/lib/auth';
import { getManageableGuilds, isValidGuildId } from '@/lib/guilds';

export const dynamic = 'force-dynamic';

/** Mulai pemasangan bot ke satu server: GET /api/install?guild=<id> */
export async function GET(request: NextRequest) {
  const base = authConfig().baseUrl;
  const guildId = request.nextUrl.searchParams.get('guild') ?? '';

  const session = await getSession();
  if (!session) return NextResponse.redirect(`${base}/login`);
  if (!isValidGuildId(guildId)) return NextResponse.redirect(`${base}/?install=invalid`);

  // Discord sendiri menolak user tanpa Manage Server, tapi cek di sini supaya
  // tombol pasang tidak bisa dipakai untuk server yang tidak dia kelola.
  const guilds = await getManageableGuilds(session.discordId);
  if (!guilds) return NextResponse.redirect(`${base}/login?error=expired`);
  if (!guilds.some((g) => g.guildId === guildId)) {
    return NextResponse.redirect(`${base}/?install=forbidden`);
  }

  const state = randomBytes(16).toString('hex');
  const response = NextResponse.redirect(installUrl(state, guildId));
  response.cookies.set(INSTALL_STATE_COOKIE, `${state}:${guildId}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/api/install',
    maxAge: 600,
  });
  return response;
}
