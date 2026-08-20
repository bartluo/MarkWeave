import { NextResponse } from 'next/server'

const GITHUB_API = 'https://api.github.com/repos/markweave/markweave/releases/latest'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'MarkWeave-Website'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return NextResponse.json({ assets: [] })
    const data = (await res.json()) as {
      assets?: Array<{ name: string; browser_download_url: string }>
    }
    return NextResponse.json({
      assets:
        data.assets?.map((item) => ({
          name: item.name,
          browser_download_url: item.browser_download_url
        })) ?? []
    })
  } catch {
    return NextResponse.json({ assets: [] })
  }
}
