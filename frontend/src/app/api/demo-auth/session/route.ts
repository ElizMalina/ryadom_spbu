import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDemoUser, createDemoSession, demoEnabled, DEMO_COOKIE_NAME,
  DEMO_TTL_SECONDS, getDemoUser,
} from '@/modules/auth/server/demo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

export async function GET() {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers: noStore });
  const user = await getDemoUser();
  return NextResponse.json({ user }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers: noStore });
  let data: unknown;
  try { data = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!data || typeof data !== 'object') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const form = data as Record<string, unknown>;
  if (typeof form.username !== 'string' || typeof form.password !== 'string' || form.username.length > 100 || form.password.length > 200) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const user = await authenticateDemoUser(form.username, form.password);
  if (!user) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401, headers: noStore });
  const response = NextResponse.json({ user }, { headers: noStore });
  response.cookies.set(DEMO_COOKIE_NAME, createDemoSession(user.username), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: DEMO_TTL_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ user: null }, { headers: noStore });
  response.cookies.set(DEMO_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
