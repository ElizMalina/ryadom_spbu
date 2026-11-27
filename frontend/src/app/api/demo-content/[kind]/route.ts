import { NextRequest, NextResponse } from 'next/server';
import { demoEnabled, getDemoUser } from '@/modules/auth/server/demo-auth';
import { createSubmission, listForReview, listOwnArticles, listPublicWall, type Kind } from '@/modules/auth/server/demo-content';
import { hasRole } from '@/modules/auth/model/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const validKind = (value: string): value is Kind => value === 'wall' || value === 'article';

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers });
  const { kind } = await params;
  if (!validKind(kind)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (kind === 'wall' && req.nextUrl.searchParams.get('view') !== 'queue') return NextResponse.json({ items: await listPublicWall() }, { headers });
  if (kind === 'article' && req.nextUrl.searchParams.get('view') === 'mine') {
    const author = await getDemoUser();
    if (!author) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
    if (!hasRole(author, 'consultant')) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
    return NextResponse.json({ items: await listOwnArticles(author) }, { headers });
  }
  const user = await getDemoUser();
  if (!hasRole(user, kind === 'wall' ? 'moderator' : 'reviewer')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ items: await listForReview(kind) }, { headers });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers });
  const { kind } = await params;
  if (!validKind(kind)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasRole(user, kind === 'wall' ? 'student' : 'consultant')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const data = payload as Record<string, unknown>;
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  if (body.length < 1 || body.length > 5000 || (kind === 'article' && (title.length < 1 || title.length > 160))) {
    return NextResponse.json({ error: 'invalid_content' }, { status: 400 });
  }
  const item = await createSubmission(kind, user, title, body);
  return NextResponse.json({ id: item.id, status: item.status }, { status: 201, headers });
}
