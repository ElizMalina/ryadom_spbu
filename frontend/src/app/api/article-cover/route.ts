import { NextRequest } from 'next/server';
import { generateArticleCover } from '@/modules/education/lib/generated-cover';

export function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? '';
  const topic = request.nextUrl.searchParams.get('topic') ?? '';
  const summary = request.nextUrl.searchParams.get('summary') ?? '';
  const svg = generateArticleCover(title, topic, summary);
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
