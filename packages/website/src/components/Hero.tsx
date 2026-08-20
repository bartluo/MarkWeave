'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { revealClass } from '@/lib/sections'
import { useTilt } from '@/hooks/useTilt'
import MockWindow from './MockWindow'
import { CheckIcon, DownloadIcon, GitHubIcon } from './Icons'

export default function Hero() {
  const stageRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  useTilt(stageRef, winRef)

  return (
    <header className="hero">
      <div className="wrap">
        <div className={revealClass(undefined, 'eyebrow')}>
          <span className="tag">v0.19.0</span> 开源免费 · 跨平台 Markdown 编辑器
        </div>
        <h1 className={revealClass('d1', 'hero-title')}>
          所见即所得，<span className="grad-text">写作不打断。</span>
        </h1>
        <p className={revealClass('d2', 'hero-sub')}>
          MarkWeave 实时渲染你的 Markdown：标题、表格、公式和流程图直接呈现，无需切换预览模式。
        </p>
        <div className={revealClass('d3', 'hero-cta')}>
          <Link className="btn btn-primary btn-lg" href="/download">
            <DownloadIcon />
            免费下载
          </Link>
          <Link className="btn btn-ghost btn-lg" href="/pricing">
            查看价格
          </Link>
          <a className="btn btn-ghost btn-lg" href={DOWNLOAD.repo} {...EXT_LINK}>
            <GitHubIcon />
            GitHub 开源
          </a>
        </div>
        <div className={revealClass('d4', 'hero-note')}>
          <span>
            <CheckIcon /> macOS / Windows / Linux
          </span>
          <span>
            <CheckIcon /> 无需注册，无追踪
          </span>
          <span>
            <CheckIcon /> 开源 · MIT 协议
          </span>
        </div>

        <div className={revealClass('d2', 'stage')} id="stage" ref={stageRef}>
          <div className="stage-glow" />
          <MockWindow title="产品发布.md" showActions windowId="heroWin" windowRef={winRef}>
            <h1>
              发布笔记 <span className="cursor" />
            </h1>
            <p className="doc-sub">一篇完全用 Markdown 写成的工作文档。</p>
            <p className="lead">
              MarkWeave 在输入的同时渲染格式：标题自然变大，<em>强调</em>自动倾斜，<code className="inline">代码</code>即刻成形，全程不用离开当前页面。
            </p>
            <h2>本次更新</h2>
            <ul>
              <li>无需预览面板，输入即渲染</li>
              <li>33 款内置主题，支持自定义 CSS</li>
              <li>表格、数学公式、脚注与图表开箱即用</li>
            </ul>
            <blockquote>“最好的 Markdown 编辑器会让人忘记工具本身。MarkWeave 就是这样。”</blockquote>
            <pre>
              <span className="c">{'# 导出命令'}</span>
              {'\n'}
              <span className="k">markweave</span> notes.md <span className="f">--export</span>{' '}
              <span className="s">pdf</span>
            </pre>
          </MockWindow>
        </div>
      </div>
    </header>
  )
}
