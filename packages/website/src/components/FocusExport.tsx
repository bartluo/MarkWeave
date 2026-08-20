import FeatureCard from './FeatureCard'
import { ExportIcon, TargetIcon } from './Icons'

export default function FocusExport() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="grid-3 grid-2">
          <FeatureCard
            variant="lg"
            icon={<TargetIcon />}
            title="专注模式与打字机模式"
            description="除当前行之外全部淡化，并让光标保持在屏幕中央。天生免打扰。"
          >
            <div className="mini mini--lg">
              <span style={{ opacity: 0.3 }}>上方段落逐渐淡出。</span>
              <br />
              <span style={{ color: 'var(--text)' }}>
                这一行始终保持清晰并居中。
                <span className="cursor" />
              </span>
              <br />
              <span style={{ opacity: 0.3 }}>下一段正在等待轮到自己。</span>
            </div>
          </FeatureCard>

          <FeatureCard
            variant="lg"
            delay="d1"
            icon={<ExportIcon />}
            title="随处导出"
            description={
              <>
                把任意文档变成排版精美的 <strong>PDF</strong> 或自包含的 <strong>HTML</strong> 文件，主题一并保留。
              </>
            }
          >
            <div className="platforms platforms--start">
              <div className="plat plat--compact"><b>PDF</b></div>
              <div className="plat plat--compact"><b>HTML</b></div>
              <div className="plat plat--compact"><b>.md</b></div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}
