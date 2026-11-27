import { NextResponse } from 'next/server';
import { getDemoUser } from '@/modules/auth/server/demo-auth';
import { canManageMeetings, listAvailableStudents } from '@/modules/events/server/demo-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  if (!canManageMeetings(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  try {
    return NextResponse.json({ students: await listAvailableStudents(user) }, { headers });
  } catch {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503, headers });
  }
}
