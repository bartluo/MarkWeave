import type { ReactNode } from 'react'
import { SECTIONS, type RevealDelay } from '@/lib/sections'
import FeatureCard from './FeatureCard'
import {
  CodeIcon,
  DiagramIcon,
  FootnoteIcon,
  FrontmatterIcon,
  MathIcon,
  TableIcon
} from './Icons'

type Card = {
  icon: ReactNode
  title: string
  description: string
  mini: ReactNode
  delay?: RevealDelay
}

const CARDS: Card[] = [
  {
    icon: <TableIcon />,
    title: '表格',
    description: '可视化搭建，或用 Markdown 直接书写。',
    mini: (
      <div className="tbl">
        <span className="h">功能</span>
        <span className="h">免费</span>
        <span className="h">Pro</span>
        <span>实时预览</span>
        <span>✓</span>
        <span>✓</span>
        <span>主题</span>
        <span>✓</span>
        <span>✓</span>
      </div>
    )
  },
  {
    icon: <MathIcon />,
    title: '数学公式',
    description: 'KaTeX 行内与块级公式，即时渲染。',
    delay: 'd1',
    mini: (
      <div className="katex">
        e<sup>iπ</sup> + 1 = 0&nbsp;&nbsp;·&nbsp;&nbsp;∫<sub>0</sub>
        <sup>∞</sup> x² dx
      </div>
    )
  },
  {
    icon: <DiagramIcon />,
    title: '流程图',
    description: '支持 Mermaid、Vega 与 Vega-Lite 图表。',
    delay: 'd2',
    mini: (
      <div className="mermaid-flow">
        <span className="node">写作</span>
        <span className="arrow">→</span>
        <span className="node">渲染</span>
        <span className="arrow">→</span>
        <span className="node">发布</span>
      </div>
    )
  },
  {
    icon: <FootnoteIcon />,
    title: '脚注',
    description: '双向引用的脚注，编号自动重排。',
    mini: (
      <>
        草稿写于 2024 年。
        <sup style={{ color: 'var(--accent)' }}>[1]</sup>
        <br />
        <span style={{ color: 'var(--muted)' }}>[1]: MarkWeave 满十周年的那一年。</span>
      </>
    )
  },
  {
    icon: <CodeIcon />,
    title: '代码块',
    description: '数百种语言的语法高亮。',
    delay: 'd1',
    mini: (
      <>
        <span className="c">{'// fib.js'}</span>
        <br />
        <span style={{ color: 'var(--a1)' }}>const</span> fib = n =&gt;
        <br />
        &nbsp;&nbsp;n &lt; 2 ? n : fib(n-1)+fib(n-2);
      </>
    )
  },
  {
    icon: <FrontmatterIcon />,
    title: 'Front Matter',
    description: '支持 YAML、TOML 和 JSON 元信息，适配博客与静态站点。',
    delay: 'd2',
    mini: (
      <>
        <span style={{ color: 'var(--muted)' }}>---</span>
        <br />
        <span style={{ color: 'var(--accent)' }}>title</span>: Hello World
        <br />
        <span style={{ color: 'var(--accent)' }}>tags</span>: [markdown, notes]
        <br />
        <span style={{ color: 'var(--muted)' }}>---</span>
      </>
    )
  }
]

export default function Extensions() {
  return (
    <section className="block" id={SECTIONS.extensions}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Markdown 扩展</span>
          <h2 className="sec-title">不止于基础语法。</h2>
          <p className="sec-desc">
            表格、公式、图表、脚注与 Front Matter 全部一等支持，全部实时渲染。
          </p>
        </div>
        <div className="grid-3">
          {CARDS.map((c) => (
            <FeatureCard
              key={c.title}
              icon={c.icon}
              title={c.title}
              description={c.description}
              delay={c.delay}
            >
              <div className="mini">{c.mini}</div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </section>
  )
}
