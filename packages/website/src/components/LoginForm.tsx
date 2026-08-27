'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const ERROR_TEXT: Record<string, string> = {
  INVALID_INPUT: '请检查填写的内容',
  USER_NOT_FOUND: '没有找到该邮箱的账户',
  INVALID_PASSWORD: '邮箱或密码不正确',
  AUTH_SERVICE_UNAVAILABLE: '认证服务暂时不可用，请稍后重试'
}

export default function LoginForm() {
  const searchParams = useSearchParams()
  const desktopState = searchParams.get('desktop_auth') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const login = async () => {
    setError('')
    if (!validEmail) {
      setError('请输入正确的邮箱地址')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string }
      if (!res.ok || !data.ok || !data.token) {
        setError(ERROR_TEXT[data.error ?? ''] ?? '登录失败，请稍后重试')
        return
      }
      setToken(data.token)
      if (!desktopState) {
        setLoggedIn(true)
        return
      }
      const complete = await fetch('/api/auth/desktop/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.token}`
        },
        body: JSON.stringify({ state: desktopState })
      })
      const completeData = (await complete.json()) as { ok?: boolean; code?: string; error?: string }
      if (!complete.ok || !completeData.ok || !completeData.code) {
        setError(completeData.error === 'SESSION_EXPIRED' ? '登录窗口已过期，请在客户端重新打开' : '同步到客户端失败，请重试')
        return
      }
      window.location.href = `/auth/complete?state=${encodeURIComponent(desktopState)}&code=${encodeURIComponent(completeData.code)}`
    } finally {
      setLoading(false)
    }
  }

  if (loggedIn) {
    return (
      <div className="auth-card auth-card--success">
        <h2>登录成功</h2>
        <p>你已经登录 MarkWeave 账户，现在可以返回客户端继续使用。</p>
        <Link className="auth-btn" href="/">返回首页</Link>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <div className="auth-fields">
        <label htmlFor="login-email">邮箱</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
        />

        <label htmlFor="login-password">密码</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入密码"
          autoComplete="current-password"
        />

        {error && <p className="auth-message auth-message--error">{error}</p>}

        <button type="button" className="auth-btn" disabled={loading} onClick={login}>
          {loading ? '登录中…' : '登录'}
        </button>

        <p className="auth-switch-line">
          还没有账户？<Link href="/register">立即注册</Link>
        </p>
      </div>
    </div>
  )
}
