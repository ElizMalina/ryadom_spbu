import { NextResponse } from 'next/server';
import { getDemoUser } from '@/modules/auth/server/demo-auth';
import { removeMeetingForUser } from '@/modules/events/server/demo-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
  try {
    const result = await removeMeetingForUser(user, id);
    if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
    return NextResponse.json({ action: result }, { headers });
  } catch {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503, headers });
  }
}
