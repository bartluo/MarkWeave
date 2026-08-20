import type { ReactNode } from 'react'
import Link from 'next/link'
import { SECTIONS } from '@/lib/sections'
import { LinuxIcon, MacIcon, WindowsIcon } from './Icons'

type Platform = { icon: ReactNode; label: string; sub: string }

const PLATFORMS: Platform[] = [
  { icon: <MacIcon />, label: 'macOS', sub: '.dmg · Apple Silicon 与 Intel' },
  { icon: <WindowsIcon />, label: 'Windows', sub: '.exe · x64 与 ARM64' },
  { icon: <LinuxIcon />, label: 'Linux', sub: '.AppImage · .deb · .rpm' }
]

export default function Download() {
  return (
    <section className="block" id={SECTIONS.download}>
      <div className="wrap">
        <div className="cta reveal">
          <div className="cta-glow" />
          <span className="kicker kicker--center">免费下载</span>
          <h2>
            两分钟，<span className="grad-text">开始写作</span>。
          </h2>
          <p>一个安装包，无需账号、无需订阅。所有桌面平台都能用。</p>
          <div className="platforms">
            {PLATFORMS.map((p) => (
              <Link className="plat" key={p.label} href="/download">
                {p.icon}
                <div>
                  <b>{p.label}</b>
                  <span>{p.sub}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="hero-note hero-note--cta">
            <span>
              也可通过 Homebrew 安装：<code className="inline">brew install --cask mark-text</code>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
