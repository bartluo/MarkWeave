import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS } from '@/lib/sections'
import { HeartIcon } from './Icons'

export default function Support() {
  return (
    <section className="block" id={SECTIONS.support}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">支持项目</span>
          <h2 className="sec-title">一起让 MarkWeave 保持免费。</h2>
          <p className="sec-desc">
            项目由社区志愿者维护。如果它值得留在你的工作流里，赞助能帮助开发持续下去。
          </p>
          <div className="hero-cta hero-cta--center">
            <a className="btn btn-primary btn-lg" href={DOWNLOAD.sponsor} {...EXT_LINK}>
              <HeartIcon />
              GitHub 赞助
            </a>
          </div>
        </div>

        <div className="sponsors-wall reveal d1">
          <span className="sponsors-label">感谢赞助方</span>
          <div className="sponsor-logos">
            <a className="sponsor-logo" href={DOWNLOAD.serpapi} {...EXT_LINK} title="SerpApi">
              <img src="/assets/serpapi.png" alt="SerpApi" loading="lazy" />
            </a>
            <a className="sponsor-logo" href={DOWNLOAD.ukey} {...EXT_LINK} title="UKey Wallet">
              <img className="sponsor-logo-raw" src="/assets/ukey.png" alt="UKey Wallet" loading="lazy" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
