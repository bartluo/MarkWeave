import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: '隐私政策',
  description: 'MarkWeave 隐私政策，由昆明泛莱科技有限公司运营。'
}

export default function PrivacyPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="kicker">隐私政策</span>
            <h1>我们重视你的隐私。</h1>
            <p className="page-hero-sub">
              本政策由昆明泛莱科技有限公司制定，说明 MarkWeave 如何收集、使用和保护你的信息。
            </p>
          </div>
        </section>
        <section className="block block--top-tight">
          <div className="wrap">
            <div className="legal-card">
              <h2>我们收集哪些信息</h2>
              <p>注册或购买时，我们会收集邮箱、称呼和订单信息，用于账号登录、授权签发与售后服务。</p>
              <h2>文档数据</h2>
              <p>你的 Markdown 文档默认保存在本地设备上。只有使用云同步等付费功能时，相关文档才会上传到服务器。</p>
              <h2>信息安全</h2>
              <p>我们通过 HTTPS 加密传输数据，并限制内部人员访问权限，防止信息被泄露、篡改或丢失。</p>
              <h2>联系我们</h2>
              <p>
                如有隐私相关问题，请拨打 <a href="tel:13085378663">13085378663</a>，或通过页面右下角的微信客服与我们联系。
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
