'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const ERROR_TEXT: Record<string, string> = {
  INVALID_INPUT: '请检查填写的内容',
  EMAIL_EXISTS: '该邮箱已注册，请直接登录',
  VERIFICATION_REQUIRED: '请先获取并输入邮箱验证码',
  VERIFICATION_USED: '该验证码已使用，请重新获取',
  VERIFICATION_TOO_FREQUENT: '发送太频繁，请稍后再试',
  TOO_MANY_ATTEMPTS: '验证码错误次数过多，请重新获取',
  INVALID_CODE: '验证码不正确',
  CODE_EXPIRED: '验证码已过期，请重新获取',
  MAIL_SEND_FAILED: '验证码发送失败，请稍后重试',
  AUTH_SERVICE_UNAVAILABLE: '认证服务暂时不可用，请稍后重试'
}

export default function RegisterForm() {
  const searchParams = useSearchParams()
  const desktopState = searchParams.get('desktop_auth') ?? ''
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState('')
  const [registered, setRegistered] = useState(false)

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const sendCode = async () => {
    setError('')
    setMessage('')
    if (!validEmail) {
      setError('请输入正确的邮箱地址')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/auth/verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; devFallback?: boolean }
      if (!res.ok || !data.ok) {
        setError(ERROR_TEXT[data.error ?? ''] ?? '发送失败，请稍后重试')
        return
      }
      setMessage(
        data.devFallback
          ? '验证码已生成（开发模式，请查看服务器日志）'
          : '验证码已发送到你的邮箱，10 分钟内有效'
      )
      setCountdown(60)
      const timer = window.setInterval(() => {
        setCountdown((value) => {
          if (value <= 1) {
            window.clearInterval(timer)
            return 0
          }
          return value - 1
        })
      }, 1000)
    } finally {
      setSending(false)
    }
  }

  const completeDesktopAuth = async (accessToken: string): Promise<boolean> => {
    if (!desktopState) return false
    const res = await fetch('/api/auth/desktop/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ state: desktopState })
    })
    const data = (await res.json()) as { ok?: boolean; code?: string; error?: string }
    if (!res.ok || !data.ok || !data.code) {
      setError(ERROR_TEXT[data.error ?? ''] ?? '同步到客户端失败，请重试')
      return true
    }
    window.location.href = `/auth/complete?state=${encodeURIComponent(desktopState)}&code=${encodeURIComponent(data.code)}`
    return true
  }

  const register = async () => {
    setError('')
    setMessage('')
    if (!displayName.trim()) {
      setError('请输入昵称')
      return
    }
    if (!validEmail) {
      setError('请输入正确的邮箱地址')
      return
    }
    if (password.length < 8) {
      setError('密码至少需要 8 位')
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('请输入 6 位邮箱验证码')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          verificationCode: code.trim()
        })
      })
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string }
      if (!res.ok || !data.ok) {
        setError(ERROR_TEXT[data.error ?? ''] ?? '注册失败，请稍后重试')
        return
      }
      if (data.token) {
        setToken(data.token)
        const handled = await completeDesktopAuth(data.token)
        if (!handled) setRegistered(true)
      } else {
        setRegistered(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (registered) {
    return (
      <div className="auth-card auth-card--success">
        <h2>注册成功</h2>
        <p>你的 MarkWeave 账户已创建，现在可以返回客户端继续使用。</p>
        <Link className="auth-btn" href="/">返回首页</Link>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <div className="auth-fields">
        <label htmlFor="auth-name">昵称</label>
        <input
          id="auth-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="你的昵称"
          maxLength={64}
        />

        <label htmlFor="auth-email">邮箱</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
        />

        <label htmlFor="auth-password">密码</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 位"
          autoComplete="new-password"
        />

        <label htmlFor="auth-code">邮箱验证码</label>
        <div className="auth-code-row">
          <input
            id="auth-code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 位验证码"
          />
          <button
            type="button"
            className="auth-btn auth-btn--ghost"
            disabled={sending || countdown > 0}
            onClick={sendCode}
          >
            {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
          </button>
        </div>

        {message && <p className="auth-message auth-message--ok">{message}</p>}
        {error && <p className="auth-message auth-message--error">{error}</p>}

        <button
          type="button"
          className="auth-btn"
          disabled={submitting}
          onClick={register}
        >
          {submitting ? '注册中…' : '注册'}
        </button>

        <p className="auth-switch-line">
          已有账户？<Link href="/login">直接登录</Link>
        </p>
      </div>
    </div>
  )
}
