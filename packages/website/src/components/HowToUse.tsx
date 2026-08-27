import Link from 'next/link'
import { SECTIONS, revealClass, type RevealDelay } from '@/lib/sections'
import { BoltIcon, DownloadIcon, ExportIcon, LinesIcon } from './Icons'

type Step = {
  icon: React.ReactNode
  title: string
  text: string
  tag: string
  delay?: RevealDelay
}

const STEPS: Step[] = [
  {
    icon: <DownloadIcon />,
    title: '下载并安装',
    text: '选择 macOS、Windows 或 Linux 安装包，按页面提示完成安装。',
    tag: '01'
  },
  {
    icon: <LinesIcon />,
    title: '新建文档',
    text: '打开应用新建 .md 文件，或直接打开本地已有的 Markdown 文档。',
    tag: '02',
    delay: 'd1'
  },
  {
    icon: <BoltIcon />,
    title: '实时写作',
    text: '直接输入 Markdown，格式实时呈现；命令面板可用 Ctrl/Cmd + Shift + P 打开。',
    tag: '03',
    delay: 'd2'
  },
  {
    icon: <ExportIcon />,
    title: '导出分享',
    text: 'Pro 可导出 PDF / HTML，商业版支持多设备云同步与 30 天版本历史。',
    tag: '04',
    delay: 'd3'
  }
]

export default function HowToUse() {
  return (
    <section className="block" id={SECTIONS.guide}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">使用说明</span>
          <h2 className="sec-title">四步上手，没有学习成本。</h2>
          <p className="sec-desc">从安装到产出第一份文档，通常只需要两分钟。</p>
        </div>
        <div className="howto-grid">
          {STEPS.map((step) => (
            <div className={revealClass(step.delay, 'howto-step')} key={step.tag}>
              <div className="howto-head">
                <div className="howto-ic">{step.icon}</div>
                <span className="howto-tag">{step.tag}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
        <div className={revealClass('d1', 'howto-cta')}>
          <Link className="btn btn-primary" href="/download">
            立即下载
          </Link>
        </div>
      </div>
    </section>
  )
}
