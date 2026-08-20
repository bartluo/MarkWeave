'use client'

import { useEffect, useState } from 'react'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { LinuxIcon, MacIcon, SmartphoneIcon, WindowsIcon } from '@/components/Icons'

type Asset = {
  name: string
  browser_download_url: string
}

type PlatformSpec = {
  id: string
  label: string
  file: string
  arch: string
  icon: React.ReactNode
  match?: RegExp
  prefer?: RegExp
  disabled?: boolean
}

const PLATFORMS: PlatformSpec[] = [
  {
    id: 'macos',
    label: 'macOS',
    file: '.dmg / .zip',
    arch: 'Apple Silicon / Intel',
    icon: <MacIcon />,
    match: /^markweave-mac-(arm64|x64)-.+\.(dmg|zip)$/i,
    prefer: /\.dmg$/i
  },
  {
    id: 'windows',
    label: 'Windows',
    file: '.exe / .zip',
    arch: 'x64 / ARM64',
    icon: <WindowsIcon />,
    match: /^markweave-win-(x64|arm64)-.+\.(exe|zip)$/i,
    prefer: /-setup\.exe$/i
  },
  {
    id: 'linux',
    label: 'Linux',
    file: '.AppImage / .deb / .rpm',
    arch: 'x86_64',
    icon: <LinuxIcon />,
    match: /^markweave-linux-.+\.(AppImage|deb|rpm|snap|tar\.gz)$/i,
    prefer: /\.AppImage$/i
  },
  {
    id: 'ios',
    label: 'iOS / iPadOS',
    file: '暂无安装包',
    arch: 'Apple 移动设备',
    icon: <SmartphoneIcon />,
    disabled: true
  }
]

const API = '/api/releases/latest'

export default function LatestDownloads() {
  const [assets, setAssets] = useState<Asset[] | null>(null)

  useEffect(() => {
    fetch(API)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { assets?: Asset[] } | null) => setAssets(data?.assets ?? []))
      .catch(() => setAssets([]))
  }, [])

  return (
    <>
      <div className="quick-dl">
        {PLATFORMS.map((platform) => (
          <DownloadCard key={platform.id} platform={platform} assets={assets} />
        ))}
      </div>
      <p className="quick-dl-hint">
        {assets === null
          ? '正在读取 GitHub 最新发布信息…'
          : '安装包来自 GitHub Releases；iOS / iPadOS 是桌面应用暂未支持的平台。'}
      </p>
    </>
  )
}

function DownloadCard({
  platform,
  assets
}: {
  platform: PlatformSpec
  assets: Asset[] | null
}) {
  if (platform.disabled) {
    return (
      <div className="quick-dl-card is-disabled">
        {platform.icon}
        <div>
          <b>{platform.label}</b>
          <span>
            {platform.file} · {platform.arch}
          </span>
        </div>
        <em>暂未支持</em>
      </div>
    )
  }

  const asset = assets?.find(
    (item) =>
      platform.match?.test(item.name) &&
      (!platform.prefer || platform.prefer.test(item.name))
  )

  return (
    <a
      className="quick-dl-card"
      href={asset?.browser_download_url ?? DOWNLOAD.latest}
      title={asset?.name ?? '前往 GitHub Releases 查看安装包'}
      {...EXT_LINK}
    >
      {platform.icon}
      <div>
        <b>{platform.label}</b>
        <span>{asset ? asset.name : `${platform.file} · ${platform.arch}`}</span>
      </div>
      <em>{asset ? '下载' : '发布页'}</em>
    </a>
  )
}
