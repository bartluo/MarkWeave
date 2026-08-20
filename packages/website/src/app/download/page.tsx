import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import InstallGuide from '@/components/download/InstallGuide'
import LatestDownloads from '@/components/download/LatestDownloads'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: '下载 MarkWeave',
  description:
    '免费下载 MarkWeave 跨平台 Markdown 编辑器：macOS、Windows、Linux 安装包与分平台安装方法；iOS/iPadOS 暂未支持。'
}

export default function DownloadPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="kicker">下载中心</span>
            <h1>
              下载 <span className="grad-text">MarkWeave</span>
            </h1>
            <p className="page-hero-sub">
              免费、开源、跨平台。选择你的系统，几分钟内开始写作。
            </p>
            <LatestDownloads />
            <div className="hero-note page-hero-note">
              <span>安装包来自 GitHub Releases</span>
              <span>支持自动更新</span>
              <span>iOS / iPadOS 暂未支持</span>
            </div>
          </div>
        </section>

        <section className="block block--top-tight">
          <div className="wrap">
            <div className="sec-head center reveal">
              <span className="kicker">安装方法</span>
              <h2 className="sec-title">按你的系统选择安装方式。</h2>
              <p className="sec-desc">支持图形安装包、命令行包管理器，以及免安装便携版。</p>
            </div>
            <InstallGuide />
          </div>
        </section>

        <section className="block">
          <div className="wrap">
            <div className="verify-band">
              <div>
                <span className="kicker">校验下载</span>
                <h2>验证文件完整性</h2>
                <p>
                  每个版本都附带 latest-*.yml 校验文件。下载后运行下面的命令，与 release 页面上的 SHA-512 值比对。
                </p>
              </div>
              <pre>
                <code>shasum -a 512 markweave-linux-{`<version>`}.AppImage</code>
              </pre>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
