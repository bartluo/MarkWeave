import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '登录完成',
  description: 'MarkWeave 桌面端登录完成。'
}

export default function AuthCompletePage() {
  return (
    <main className="auth-complete-page">
      <div className="auth-card auth-card--success">
        <h2>登录完成</h2>
        <p>你的 MarkWeave 账户已同步，现在可以返回客户端继续使用。</p>
        <Link className="auth-btn" href="/">返回首页</Link>
      </div>
    </main>
  )
}
