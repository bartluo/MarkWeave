import { revealClass, type RevealDelay } from '@/lib/sections'

type Stat = { value: string; label: string; delay?: RevealDelay }

const STATS: Stat[] = [
  { value: '56.6k', label: 'GitHub Stars' },
  { value: '146', label: '社区贡献者', delay: 'd1' },
  { value: '3', label: '支持平台', delay: 'd2' },
  { value: 'MIT', label: '开源免费', delay: 'd3' }
]

export default function Stats() {
  return (
    <section className="block block--top-tight">
      <div className="wrap">
        <div className="stats">
          {STATS.map((s) => (
            <div className={revealClass(s.delay, 'stat')} key={s.label}>
              <div className="n grad-text">{s.value}</div>
              <div className="l">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
