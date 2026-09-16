import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeUrl, cookieSecure, STATE_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const response = NextResponse.redirect(authorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: 600,
  });
  return response;
}
