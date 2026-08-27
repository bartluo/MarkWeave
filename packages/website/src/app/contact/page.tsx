import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import { EXT_LINK } from '@/lib/links'
import { PhoneIcon, WechatIcon } from '@/components/Icons'

const KF_LINK = 'https://work.weixin.qq.com/kfid/kfc55d33041a84f1321'

export const metadata: Metadata = {
  title: '联系我们',
  description: '联系 MarkWeave 团队：电话 13085378663，或通过微信客服在线咨询。'
}

export default function ContactPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="kicker">联系我们</span>
            <h1>遇到问题，随时找我们。</h1>
            <p className="page-hero-sub">工作时间我们会尽快回复你的咨询。</p>
          </div>
        </section>
        <section className="block block--top-tight">
          <div className="wrap">
            <div className="contact-grid">
              <a className="contact-card" href="tel:13085378663">
                <div className="contact-ic">
                  <PhoneIcon />
                </div>
                <h2>电话咨询</h2>
                <p>13085378663</p>
                <span>直接拨打，与我们取得联系</span>
              </a>
              <a className="contact-card" href={KF_LINK} {...EXT_LINK}>
                <div className="contact-ic">
                  <WechatIcon />
                </div>
                <h2>微信客服</h2>
                <p>点击立即咨询</p>
                <img src="/assets/wechat-kf.jpg" alt="微信客服二维码" width={160} height={160} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
