import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import LoginForm from '@/components/LoginForm'

export const metadata: Metadata = {
  title: '登录',
  description: '登录 MarkWeave 账户，并同步到客户端。'
}

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="kicker">欢迎回来</span>
            <h1>登录 MarkWeave 账户。</h1>
            <p className="page-hero-sub">登录后客户端会自动接收登录状态，无需手动输入配对码。</p>
          </div>
        </section>
        <section className="block block--top-tight">
          <div className="wrap">
            <LoginForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
