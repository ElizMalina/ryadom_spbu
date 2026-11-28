import { NextRequest, NextResponse } from 'next/server';
import { backendAuthEnabled, backendAuthError, forwardBackendAuth } from '@/modules/auth/server/backend-auth';
import { demoEnabled, getDemoUser } from '@/modules/auth/server/demo-auth';
import { deleteOwnArticle, reviseOwnArticle, reviewSubmission, type Kind } from '@/modules/auth/server/demo-content';
import { hasRole } from '@/modules/auth/model/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== 'wall' && kind !== 'article') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (backendAuthEnabled()) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return backendAuthError(404, 'not_found');
    return forwardBackendAuth(req, `/api/v1/submissions/${kind}/${encodeURIComponent(id)}`);
  }
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503 });
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let payload: unknown;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (kind === 'article' && payload && typeof payload === 'object' && !Array.isArray(payload) &&
      ('title' in payload || 'body' in payload)) {
    if (!hasRole(user, 'consultant')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const data = payload as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const body = typeof data.body === 'string' ? data.body.trim() : '';
    if (title.length < 1 || title.length > 160 || body.length < 1 || body.length > 5000)
      return NextResponse.json({ error: 'invalid_content' }, { status: 400 });
    const updated = await reviseOwnArticle(user, id, title, body);
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ id: updated.id, status: updated.status }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (!hasRole(user, kind === 'wall' ? 'moderator' : 'reviewer'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const status = (payload as { status?: unknown } | null)?.status;
  if (status !== 'approved' && status !== 'rejected') return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  const updated = await reviewSubmission(kind as Kind, id, status);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ id: updated.id, status: updated.status }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== 'article') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (backendAuthEnabled()) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return backendAuthError(404, 'not_found');
    return forwardBackendAuth(req, `/api/v1/submissions/${kind}/${encodeURIComponent(id)}`);
  }
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503 });
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasRole(user, 'consultant')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const deleted = await deleteOwnArticle(user, id);
  if (!deleted) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
