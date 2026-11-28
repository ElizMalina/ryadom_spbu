import { NextRequest, NextResponse } from 'next/server';
import { backendAuthEnabled, forwardBackendAuth } from '@/modules/auth/server/backend-auth';
import { getDemoUser, listDemoUsers, updateDemoRoles } from '@/modules/auth/server/demo-auth';
import { hasRole, isUserRole } from '@/modules/auth/model/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
async function isAdmin() { return hasRole(await getDemoUser(), 'admin'); }

export async function GET(request: NextRequest) {
  if (backendAuthEnabled()) return forwardBackendAuth(request, '/api/v1/users');
  if (!(await isAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  return NextResponse.json({ users: await listDemoUsers() }, { headers: noStore });
}
export async function PATCH(req: NextRequest) {
  if (backendAuthEnabled()) return forwardBackendAuth(req, '/api/v1/users');
  if (!(await isAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.username !== 'string' || !Array.isArray(input.roles) || input.roles.length === 0 || !input.roles.every(isUserRole)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const updated = await updateDemoRoles(input.username, input.roles);
    return NextResponse.json({ user: updated }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'role_change_not_allowed' }, { status: 400 });
  }
}
