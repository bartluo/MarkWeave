import { SECTIONS } from '@/lib/sections'
import FeatItem from './FeatItem'
import { CodeIcon, SunIcon } from './Icons'

type Swatch = {
  name: string
  bg: string
  fg: string
  accent: string
  bgBorder?: string
}

const SWATCHES: Swatch[] = [
  { name: 'Cadmium Light', bg: '#fff', fg: '#333', accent: '#3a86ff', bgBorder: '#ddd' },
  { name: 'Dark', bg: '#16161c', fg: '#cfcfe0', accent: '#a855f7' },
  { name: 'Graphite Light', bg: '#fdf6e3', fg: '#586e75', accent: '#b58900', bgBorder: '#e8dcc0' },
  { name: 'Material Dark', bg: '#0f1419', fg: '#9fb3c8', accent: '#23d18b' },
  { name: 'Ulysses Light', bg: '#f7f3ee', fg: '#5b5147', accent: '#c75e3a', bgBorder: '#e6ddcf' },
  { name: 'One Dark', bg: '#282c34', fg: '#abb2bf', accent: '#c678dd' }
]

export default function Themes() {
  return (
    <section className="block" id={SECTIONS.themes}>
      <div className="wrap">
        <div className="split rev">
          <div className="split-text">
            <div className="sec-head reveal">
              <span className="kicker">主题</span>
              <h2 className="sec-title">界面随你定制。</h2>
              <p className="sec-desc">
                33 款内置主题，浅色深色都齐全。每个主题本质上都是 CSS，可以改样式，也可以从零写一套。
              </p>
            </div>
            <div className="feat-list">
              <FeatItem
                delay="d1"
                icon={<SunIcon />}
                title="浅色 / 深色一键切换"
                description="快捷键切换，也可以跟随系统外观。"
              />
              <FeatItem
                delay="d2"
                icon={<CodeIcon />}
                title="用普通 CSS 自定义"
                description="没有私有格式，会 CSS 就能做主题。"
              />
            </div>
          </div>
          <div className="reveal d2">
            <div className="theme-grid">
              {SWATCHES.map((s) => (
                <div className="swatch" key={s.name}>
                  <div className="pv" style={{ background: s.bg, color: s.fg }}>
                    <div className="t" style={{ color: s.accent }}>
                      {s.name.split(' ')[0]}
                    </div>
                    # Heading
                    <br />
                    **bold** _italic_
                    <br />
                    &gt; quote
                  </div>
                  <div className="meta">
                    <b>{s.name}</b>
                    <div className="dots">
                      <i
                        style={{
                          background: s.bg,
                          border: s.bgBorder ? `1px solid ${s.bgBorder}` : undefined
                        }}
                      />
                      <i style={{ background: s.accent }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="theme-more reveal d1">
              <span>+27 款更多内置主题</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
