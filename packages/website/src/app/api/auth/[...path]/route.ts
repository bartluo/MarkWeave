import { NextRequest, NextResponse } from 'next/server'

const AUTH_API_URL = process.env.AUTH_API_URL ?? 'http://127.0.0.1:3230'

type RouteContext = {
  params: Promise<{ path: string[] }>
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path)
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path)
}

async function proxy(req: NextRequest, path: string[]) {
  const target = new URL(`/v1/auth/${path.join('/')}`, AUTH_API_URL)
  const headers: Record<string, string> = {}
  if (req.headers.get('content-type')) {
    headers['Content-Type'] = req.headers.get('content-type') ?? ''
  }
  if (req.headers.get('authorization')) {
    headers['Authorization'] = req.headers.get('authorization') ?? ''
  }

  try {
    const body = req.method === 'POST' ? await req.text() : undefined
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    })
    const data = await upstream.json().catch(() => null)
    return NextResponse.json(data ?? { ok: false, error: 'BAD_GATEWAY' }, {
      status: upstream.status
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'AUTH_SERVICE_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
