import { NextRequest } from 'next/server';
import { backendAuthEnabled, backendAuthError, forwardBackendAuth } from '@/modules/auth/server/backend-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!backendAuthEnabled()) return backendAuthError(404, 'not_found');
  return forwardBackendAuth(request, '/api/v1/auth/register');
}
