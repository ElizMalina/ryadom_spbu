import { NextRequest, NextResponse } from 'next/server';
import { demoEnabled, getDemoUser } from '@/modules/auth/server/demo-auth';
import { hasRole } from '@/modules/auth/model/types';
import { listPendingPractices, listPublishedPractices, parsePracticeDraft, submitPractice } from '@/modules/practices/server/demo-practices';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers });
  if (req.nextUrl.searchParams.get('view') === 'queue') {
    const user = await getDemoUser();
    if (!hasRole(user, 'reviewer')) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
    const pending = await listPendingPractices();
    return NextResponse.json({ items: pending.map(({ id, createdAt, practice }) => ({ id, createdAt, practice })) }, { headers });
  }
  return NextResponse.json({ items: await listPublishedPractices() }, { headers });
}

export async function POST(req: NextRequest) {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers });
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  if (!hasRole(user, 'consultant')) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  if (Number(req.headers.get('content-length')) > 30000) return NextResponse.json({ error: 'too_large' }, { status: 413, headers });
  let data: unknown;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers }); }
  const draft = parsePracticeDraft(data);
  if (!draft) return NextResponse.json({ error: 'invalid_content' }, { status: 400, headers });
  const result = await submitPractice(user.id, draft);
  return NextResponse.json({ id: result.id, status: result.status }, { status: 201, headers });
}
