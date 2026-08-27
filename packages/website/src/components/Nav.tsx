'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { useToggleTheme } from '@/hooks/useTheme'
import { useNavShrink } from '@/hooks/useNavShrink'
import Brand from './Brand'
import { GitHubIcon, MenuIcon, MoonIcon, SunIcon } from './Icons'

const NAV_LINKS = [
  { label: '首页', href: '/' },
  { label: '使用说明', href: '/#guide' },
  { label: '下载', href: '/download' },
  { label: '价格', href: '/pricing' },
  { label: '登录 / 注册', href: '/register' }
]

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const toggle = useToggleTheme()
  useNavShrink(navRef)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <nav className="nav" id="nav" ref={navRef}>
      <Brand />
      <div className="nav-links">
        {NAV_LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        <button
          type="button"
          className="icon-btn"
          id="themeToggle"
          aria-label="切换主题"
          title="切换主题"
          onClick={toggle}
        >
          <MoonIcon className="theme-moon" />
          <SunIcon className="theme-sun" />
        </button>
        <a className="icon-btn" href={DOWNLOAD.repo} {...EXT_LINK} aria-label="GitHub">
          <GitHubIcon />
        </a>
        <Link className="btn btn-primary nav-cta" href="/download">
          免费下载
        </Link>
        <button
          type="button"
          className="icon-btn nav-menu-btn"
          id="navMenuToggle"
          aria-label="打开菜单"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MenuIcon />
        </button>
      </div>
      {menuOpen && (
        <div className="nav-panel">
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
