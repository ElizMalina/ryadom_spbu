import { NextRequest, NextResponse } from 'next/server';
import { backendAuthEnabled, forwardBackendAuth } from '@/modules/auth/server/backend-auth';
import { getDemoUser } from '@/modules/auth/server/demo-auth';
import { hasRole } from '@/modules/auth/model/types';
import {
  canManageMeetings, createMeeting, listAssignedMeetings, listCreatedMeetings, MeetingInputError,
} from '@/modules/events/server/demo-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  if (backendAuthEnabled()) {
    const scope = request.nextUrl.searchParams.get('scope');
    const search = scope ? new URLSearchParams({ scope }) : undefined;
    return forwardBackendAuth(request, '/api/v1/events', search);
  }
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  const scope = request.nextUrl.searchParams.get('scope') || (canManageMeetings(user) ? 'created' : 'assigned');
  if (scope !== 'created' && scope !== 'assigned') {
    return NextResponse.json({ error: 'invalid_scope' }, { status: 400, headers });
  }
  if (scope === 'created' && !canManageMeetings(user) || scope === 'assigned' && !hasRole(user, 'student')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  }
  try {
    const events = scope === 'created' ? await listCreatedMeetings(user) : await listAssignedMeetings(user);
    return NextResponse.json({ events, scope }, { headers });
  } catch {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  if (backendAuthEnabled()) return forwardBackendAuth(request, '/api/v1/events');
  const user = await getDemoUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  if (!canManageMeetings(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  let data: unknown;
  try { data = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }
  try {
    const event = await createMeeting(user, data);
    return NextResponse.json({ event }, { status: 201, headers });
  } catch (error) {
    if (error instanceof MeetingInputError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers });
    }
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503, headers });
  }
}
