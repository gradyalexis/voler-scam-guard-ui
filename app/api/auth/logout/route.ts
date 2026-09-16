import { NextResponse } from 'next/server';
import { authConfig, forgetDiscordToken, getSession, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession().catch(() => null);
  if (session) {
    await forgetDiscordToken(session.discordId).catch((err) =>
      console.error('[auth] gagal menghapus token Discord saat logout', err),
    );
  }

  const response = NextResponse.redirect(`${authConfig().baseUrl}/login`, { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
