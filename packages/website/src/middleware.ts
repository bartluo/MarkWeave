import { NextResponse, type NextRequest } from 'next/server'

// 301 www.markweave.app/* -> markweave.app/* so SEO indexes a single canonical
// host. We do this in middleware rather than next.config.ts redirects()
// because OpenNext Cloudflare does not currently substitute Next's `:path*`
// destination tokens, which sends users to the literal /:path* URL (404).
export function middleware(req: NextRequest) {
  if (req.headers.get('host')?.toLowerCase() !== 'www.markweave.app') return
  const url = req.nextUrl.clone()
  url.host = 'markweave.app'
  url.protocol = 'https:'
  url.port = ''
  return NextResponse.redirect(url, 301)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|sitemap\\.xml|robots\\.txt|docs-index\\.json|assets/|docs/).*)'
  ]
}
