import Link from 'next/link'
import { EXT_LINK } from '@/lib/links'
import Brand from './Brand'
import { PhoneIcon, WechatIcon } from './Icons'

const KF_LINK = 'https://work.weixin.qq.com/kfid/kfc55d33041a84f1321'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>一款简洁、专注的 Markdown 编辑器。所见即所得，专注写作本身。</p>
            <div className="foot-contact">
              <a href="tel:13085378663">
                <PhoneIcon />
                13085378663
              </a>
              <a href={KF_LINK} {...EXT_LINK}>
                <WechatIcon />
                微信客服
              </a>
            </div>
          </div>
          <div className="foot-col">
            <h5>产品</h5>
            <Link href="/">首页</Link>
            <Link href="/#guide">使用说明</Link>
            <Link href="/download">下载</Link>
            <Link href="/pricing">价格</Link>
          </div>
          <div className="foot-col">
            <h5>支持</h5>
            <Link href="/privacy">隐私政策</Link>
            <Link href="/contact">联系我们</Link>
          </div>
          <div className="foot-col">
            <h5>微信客服</h5>
            <div className="foot-qr">
              <img src="/assets/wechat-kf.jpg" alt="微信客服二维码" width={120} height={120} />
              <span>扫码添加客服</span>
            </div>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 昆明泛莱科技有限公司 · 保留所有权利</span>
        </div>
      </div>
    </footer>
  )
}
