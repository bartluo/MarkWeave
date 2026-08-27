import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import RegisterForm from '@/components/RegisterForm'

export const metadata: Metadata = {
  title: '注册',
  description: '注册 MarkWeave 账户，邮箱验证后即可开始使用。'
}

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="kicker">创建账户</span>
            <h1>欢迎使用 MarkWeave。</h1>
            <p className="page-hero-sub">注册需要验证邮箱，Pro 功能与支付将在网页端完成。</p>
          </div>
        </section>
        <section className="block block--top-tight">
          <div className="wrap">
            <RegisterForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
