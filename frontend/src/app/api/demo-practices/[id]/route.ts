import { NextRequest, NextResponse } from 'next/server';
import { demoEnabled, getDemoUser } from '@/modules/auth/server/demo-auth';
import { hasRole } from '@/modules/auth/model/types';
import { decidePractice } from '@/modules/practices/server/demo-practices';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!demoEnabled()) return NextResponse.json({ error: 'demo_disabled' }, { status: 503, headers });
  const user = await getDemoUser();
  if (!hasRole(user, 'reviewer')) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  const { id } = await params;
  if (!/^[-a-f0-9]{36}$/.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400, headers });
  let data: unknown;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers }); }
  const status = (data && typeof data === 'object' ? (data as Record<string, unknown>).status : null);
  if (status !== 'approved' && status !== 'rejected') return NextResponse.json({ error: 'invalid_status' }, { status: 400, headers });
  const updated = await decidePractice(id, status);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
  return NextResponse.json({ id, status }, { headers });
}
