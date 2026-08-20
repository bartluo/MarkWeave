'use client'

import { useState } from 'react'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { LinuxIcon, MacIcon, WindowsIcon } from '@/components/Icons'

type Command = string

type Step = {
  title: string
  text?: string
  commands?: Command[]
}

type PlatformGuide = {
  id: 'macos' | 'windows' | 'linux'
  label: string
  icon: React.ReactNode
  steps: Step[]
  note: string
}

const GUIDES: PlatformGuide[] = [
  {
    id: 'macos',
    label: 'macOS',
    icon: <MacIcon />,
    steps: [
      {
        title: '下载 DMG 安装包',
        text: 'Apple Silicon 与 Intel 芯片请分别选择对应版本，文件位于 GitHub Releases。'
      },
      {
        title: '安装应用',
        text: '打开 DMG，把 MarkWeave 图标拖入 Applications 文件夹。'
      },
      {
        title: '首次打开',
        text: '当前安装包尚未公证，首次打开若被 Gatekeeper 拦截，请右键应用选择“打开”并确认一次。'
      },
      {
        title: '可选：Homebrew 安装',
        commands: ['brew install --cask mark-text']
      }
    ],
    note: '应用启动后会检查更新；也可以从 GitHub Releases 手动下载最新版。'
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: <WindowsIcon />,
    steps: [
      {
        title: '下载安装程序',
        text: '推荐使用 setup.exe，它支持选择安装目录，并自动创建开始菜单与桌面快捷方式。'
      },
      {
        title: '运行安装向导',
        text: '双击安装包，按向导完成安装。完成后 MarkWeave 会自动关联 .md、.markdown 等文件。'
      },
      {
        title: '可选：便携版',
        text: '下载 zip 解压后直接运行 MarkWeave.exe；如需数据随程序移动，可在同级目录创建 marktext-user-data 文件夹。'
      }
    ],
    note: '卸载请到“设置 → 应用”，或运行随附的 Uninstall MarkWeave.exe。'
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: <LinuxIcon />,
    steps: [
      {
        title: 'AppImage（推荐）',
        text: '下载后赋予执行权限并运行，无需 root。',
        commands: ['chmod +x markweave-linux-<version>.AppImage', './markweave-linux-<version>.AppImage']
      },
      {
        title: 'Debian / Ubuntu',
        commands: ['sudo apt install ./markweave-linux-<version>.deb']
      },
      {
        title: 'Fedora / RHEL',
        commands: ['sudo rpm -i markweave-linux-<version>.rpm']
      },
      {
        title: 'Arch Linux',
        text: 'AUR 包名为 marktext-bin。',
        commands: ['yay -S marktext-bin']
      }
    ],
    note: 'AppImage 不会自动更新，需要新版本时重新下载即可。'
  }
]

export default function InstallGuide() {
  const [active, setActive] = useState<PlatformGuide['id']>('macos')
  const guide = GUIDES.find((g) => g.id === active) ?? GUIDES[0]

  return (
    <div className="install-guide">
      <div className="install-tabs" role="tablist" aria-label="选择操作系统">
        {GUIDES.map((g) => (
          <button
            type="button"
            key={g.id}
            role="tab"
            aria-selected={active === g.id}
            className={`install-tab${active === g.id ? ' is-active' : ''}`}
            onClick={() => setActive(g.id)}
          >
            {g.icon}
            {g.label}
          </button>
        ))}
      </div>

      <div className="install-pane" role="tabpanel">
        <div className="install-steps">
          {guide.steps.map((step, i) => (
            <div className="install-step" key={step.title}>
              <div className="step-no">{String(i + 1).padStart(2, '0')}</div>
              <div className="step-body">
                <h3>{step.title}</h3>
                {step.text && <p>{step.text}</p>}
                {step.commands?.map((cmd) => (
                  <CommandLine key={cmd} code={cmd} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="install-note">{guide.note}</p>
        <div className="install-more">
          <span>所有安装包和 SHA-512 校验值都发布在 GitHub Releases：</span>
          <a className="btn btn-ghost" href={DOWNLOAD.releases} {...EXT_LINK}>
            查看全部版本
          </a>
        </div>
      </div>
    </div>
  )
}

function CommandLine({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="cmd-line">
      <code>{code}</code>
      <button type="button" onClick={copy} aria-label="复制命令">
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}
