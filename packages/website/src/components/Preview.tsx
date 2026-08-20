import { SECTIONS } from '@/lib/sections'
import FeatItem from './FeatItem'
import MockWindow from './MockWindow'
import { BoltIcon, GridSmallIcon, LinesIcon } from './Icons'

export default function Preview() {
  return (
    <section className="block" id={SECTIONS.preview}>
      <div className="wrap">
        <div className="split">
          <div className="split-text">
            <div className="sec-head reveal">
              <span className="kicker">实时渲染</span>
              <h2 className="sec-title">输入即所见，排版不等待。</h2>
              <p className="sec-desc">
                真正的所见即所得：Markdown 在键入的瞬间就地变成排版结果。没有分栏，没有预览切换。
              </p>
            </div>
            <div className="feat-list">
              <FeatItem
                delay="d1"
                icon={<BoltIcon />}
                title="原地渲染"
                description={
                  <>
                    输入 <code className="inline">## 标题</code>，标记立即消失，标题当场成形。
                  </>
                }
              />
              <FeatItem
                delay="d2"
                icon={<LinesIcon />}
                title="源码模式"
                description="需要精细控制时，一键切回原始 Markdown 编辑。"
              />
              <FeatItem
                delay="d3"
                icon={<GridSmallIcon />}
                title="粘贴即整理"
                description="粘贴富文本内容，MarkWeave 会自动转换成干净的 Markdown。"
              />
            </div>
          </div>
          <div className="reveal d2">
            <MockWindow title="typing.md" docStyle={{ minHeight: 320 }}>
              <h2 style={{ marginTop: 0 }}>正在输入</h2>
              <p>
                <span className="synt">**</span>
                <strong>加粗</strong>
                <span className="synt">**</span> 自动加粗，<span className="synt">_</span>
                <em>斜体</em>
                <span className="synt">_</span> 自动倾斜，链接写完即可点击：
                <a className="link" href="#">
                  可点击链接
                </a>{' '}
              </p>
              <p>列表也会自动成型：</p>
              <ul>
                <li>一个键完成一个项目符号</li>
                <li>层级嵌套自动处理</li>
                <li>
                  任务清单同样支持 <span className="cursor" />
                </li>
              </ul>
              <blockquote>保持心流，再也不用按渲染按钮。</blockquote>
            </MockWindow>
          </div>
        </div>
      </div>
    </section>
  )
}
