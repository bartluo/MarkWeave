import type { Metadata, Viewport } from 'next'
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/lib/sections'
import './globals.css'

const SITE_URL = 'https://markweave.app'
const TITLE = 'MarkWeave — 跨平台 Markdown 编辑器'
const DESCRIPTION =
  'MarkWeave 是一款开源、免费、跨平台的 Markdown 编辑器，支持实时渲染、数学公式、流程图、主题定制与 PDF/HTML 导出。'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | MarkWeave'
  },
  description: DESCRIPTION,
  applicationName: 'MarkWeave',
  keywords: [
    'Markdown 编辑器',
    'MarkWeave',
    '实时预览',
    '所见即所得',
    'Markdown',
    'KaTeX',
    'Mermaid',
    'PlantUML',
    'macOS',
    'Windows',
    'Linux'
  ],
  authors: [{ name: 'MarkWeave Team', url: 'https://github.com/markweave/markweave' }],
  creator: 'MarkWeave Team',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.png' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    siteName: 'MarkWeave',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/favicon.png', width: 512, height: 512, alt: 'MarkWeave logo' }]
  },
  twitter: {
    card: 'summary_large_image',
    site: '@markweaveapp',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/favicon.png']
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08080b'
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MarkWeave',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Windows, Linux',
  description: DESCRIPTION,
  url: SITE_URL,
  license: 'https://github.com/markweave/markweave/blob/develop/LICENSE',
  author: { '@type': 'Person', name: 'Ran Luo', url: 'https://github.com/Jocs' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  downloadUrl: 'https://github.com/markweave/markweave/releases/latest',
  softwareVersion: 'latest'
}

// Inline before paint to avoid theme flash.
const themeBootstrap = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!t)t=${JSON.stringify(DEFAULT_THEME)};document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme={DEFAULT_THEME}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}
