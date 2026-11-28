import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const sessionCookieName = 'ryadom_session';
const noStore = { 'Cache-Control': 'no-store' };

export function backendAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_API_BASE_URL);
}

export function backendAuthError(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function sameOriginMutation(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol;
  const host = request.headers.get('host') ?? request.nextUrl.host;
  try {
    return origin === new URL(`${protocol.replace(/:$/, '')}://${host}`).origin;
  } catch {
    return false;
  }
}

type Endpoint =
  | '/api/v1/auth/session'
  | '/api/v1/auth/register'
  | '/api/v1/users'
  | `/api/v1/submissions/${'wall' | 'article'}${string}`;

export async function forwardBackendAuth(
  request: NextRequest,
  endpoint: Endpoint,
  search?: URLSearchParams,
): Promise<Response> {
  const method = request.method;
  const withBody = method === 'POST' || method === 'PATCH';
  if (method !== 'GET' && !sameOriginMutation(request)) {
    return backendAuthError(403, 'forbidden');
  }
  if (withBody && request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return backendAuthError(415, 'invalid_request');
  }

  try {
    const base = new URL(process.env.AUTH_API_BASE_URL ?? '');
    if ((base.protocol !== 'http:' && base.protocol !== 'https:') ||
        base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
      return backendAuthError(503, 'auth_unavailable');
    }
    const url = new URL(endpoint, base);
    if (search) url.search = search.toString();

    const headers = new Headers({ Accept: 'application/json' });
    const session = request.cookies.get(sessionCookieName);
    if (session) headers.set('Cookie', `${sessionCookieName}=${encodeURIComponent(session.value)}`);
    if (withBody) headers.set('Content-Type', 'application/json');

    const upstream = await fetch(url, {
      method,
      headers,
      body: withBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return backendAuthError(502, 'auth_unavailable');
    }

    const responseHeaders = new Headers({ ...noStore, 'Content-Type': 'application/json; charset=utf-8' });
    const requestId = upstream.headers.get('x-request-id');
    if (requestId) responseHeaders.set('X-Request-ID', requestId);
    for (const cookie of upstream.headers.getSetCookie()) {
      if (cookie.startsWith(`${sessionCookieName}=`)) responseHeaders.append('Set-Cookie', cookie);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return backendAuthError(503, 'auth_unavailable');
  }
}
