import Link from 'next/link'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import Brand from './Brand'
import { GitHubIcon } from './Icons'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>一款开源、免费、跨平台的 Markdown 编辑器。所见即所得，专注写作本身。</p>
          </div>
          <div className="foot-col">
            <h5>产品</h5>
            <Link href="/">首页</Link>
            <Link href="/#guide">使用说明</Link>
            <Link href="/download">下载</Link>
            <Link href="/pricing">价格</Link>
          </div>
          <div className="foot-col">
            <h5>资源</h5>
            <Link href="/docs">文档</Link>
            <a href={DOWNLOAD.releases} {...EXT_LINK}>更新记录</a>
            <a href={DOWNLOAD.contributing} {...EXT_LINK}>参与贡献</a>
            <a href={DOWNLOAD.issues} {...EXT_LINK}>问题反馈</a>
          </div>
          <div className="foot-col">
            <h5>社区</h5>
            <a href={DOWNLOAD.repo} {...EXT_LINK}>GitHub</a>
            <a href={DOWNLOAD.sponsor} {...EXT_LINK}>支持项目</a>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 MarkWeave · 基于 MIT 协议开源</span>
          <div className="foot-social">
            <a className="icon-btn" href={DOWNLOAD.repo} {...EXT_LINK} aria-label="GitHub">
              <GitHubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
