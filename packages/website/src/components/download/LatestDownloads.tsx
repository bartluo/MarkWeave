'use client'

import { useEffect, useState } from 'react'
import { EXT_LINK } from '@/lib/links'
import { LinuxIcon, MacIcon, SmartphoneIcon, WindowsIcon } from '@/components/Icons'

type DownloadFile = {
  name: string
  url: string
  size?: number
}

type DownloadManifest = {
  version?: string
  platforms?: {
    macos?: DownloadFile[]
    windows?: DownloadFile[]
    linux?: DownloadFile[]
  }
}

type PlatformSpec = {
  id: string
  label: string
  file: string
  arch: string
  icon: React.ReactNode
  key: keyof NonNullable<DownloadManifest['platforms']> | 'ios'
  prefer?: (files: DownloadFile[]) => DownloadFile | undefined
  disabled?: boolean
}

const PLATFORMS: PlatformSpec[] = [
  {
    id: 'macos',
    label: 'macOS',
    file: '.dmg / .zip',
    arch: 'Apple Silicon / Intel',
    icon: <MacIcon />,
    key: 'macos',
    prefer: (files) => files.find((f) => f.name.toLowerCase().endsWith('.dmg')) ?? files[0]
  },
  {
    id: 'windows',
    label: 'Windows',
    file: '.exe / .zip',
    arch: 'x64 / ARM64',
    icon: <WindowsIcon />,
    key: 'windows',
    prefer: (files) => files.find((f) => f.name.toLowerCase().includes('setup')) ?? files[0]
  },
  {
    id: 'linux',
    label: 'Linux',
    file: '.AppImage / .deb / .rpm',
    arch: 'x86_64',
    icon: <LinuxIcon />,
    key: 'linux',
    prefer: (files) => files.find((f) => f.name.toLowerCase().endsWith('.appimage')) ?? files[0]
  },
  {
    id: 'ios',
    label: 'iOS / iPadOS',
    file: '暂无安装包',
    arch: 'Apple 移动设备',
    icon: <SmartphoneIcon />,
    key: 'ios',
    disabled: true
  }
]

export default function LatestDownloads() {
  const [manifest, setManifest] = useState<DownloadManifest | null>(null)

  useEffect(() => {
    fetch('/downloads/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DownloadManifest | null) => setManifest(data))
      .catch(() => setManifest(null))
  }, [])

  return (
    <>
      <div className="quick-dl">
        {PLATFORMS.map((platform) => (
          <DownloadCard key={platform.id} platform={platform} manifest={manifest} />
        ))}
      </div>
      <p className="quick-dl-hint">
        {manifest === null
          ? '正在读取安装包列表…'
          : '安装包托管在 markweave.cloud，国内可直接下载；iOS / iPadOS 是桌面应用暂未支持的平台。'}
      </p>
    </>
  )
}

function DownloadCard({
  platform,
  manifest
}: {
  platform: PlatformSpec
  manifest: DownloadManifest | null
}) {
  const files =
    platform.key === 'ios'
      ? []
      : (manifest?.platforms?.[platform.key] ?? [])
  const file = platform.prefer?.(files) ?? files[0]

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

  if (!file) {
    return (
      <div className="quick-dl-card is-disabled">
        {platform.icon}
        <div>
          <b>{platform.label}</b>
          <span>
            {platform.file} · {platform.arch}
          </span>
        </div>
        <em>暂无安装包</em>
      </div>
    )
  }

  return (
    <a
      className="quick-dl-card"
      href={file.url}
      title={file.name}
      {...EXT_LINK}
    >
      {platform.icon}
      <div>
        <b>{platform.label}</b>
        <span>{file.name}</span>
      </div>
      <em>下载</em>
    </a>
  )
}
