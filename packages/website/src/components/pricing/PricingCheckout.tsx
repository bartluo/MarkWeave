'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckIcon, DownloadIcon, GitHubIcon } from '@/components/Icons'

type PlanId = 'pro' | 'commercial' | 'trial'
type Method = 'alipay' | 'wechat' | 'creem'

type Plan = {
  id: PlanId
  name: string
  tagline: string
  price: number
  features: string[]
  badge?: string
  featured?: boolean
}

type OrderState = {
  orderId?: string
  qrUrl?: string
  payUrl?: string
  licenseKey?: string
  status?: string
}

const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    tagline: '完整导出与全部主题，适合专业写作',
    price: 39,
    badge: '最受欢迎',
    featured: true,
    features: [
      '免费版全部功能',
      '导出 PDF，高质量排版',
      '导出自包含 HTML',
      '33+ 款全部主题',
      'PlantUML 图支持',
      '高级代码块高亮'
    ]
  },
  {
    id: 'commercial',
    name: '商业版',
    tagline: '一次性购买，永久使用全部功能，含云同步',
    price: 199,
    badge: '含云同步',
    features: [
      'Pro 全部功能',
      '多设备实时云同步',
      '云端文档库，最多 500 篇',
      '30 天版本历史',
      '端到端加密传输',
      '优先技术支持'
    ]
  }
]

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: 'alipay', label: '支付宝', hint: '扫码支付' },
  { id: 'wechat', label: '微信支付', hint: '扫码支付' },
  { id: 'creem', label: '国际卡', hint: 'Creem 收银台' }
]

const PRICE_FALLBACK: Record<'pro' | 'commercial', number> = {
  pro: 3900,
  commercial: 19900
}

export default function PricingCheckout() {
  const [selected, setSelected] = useState<PlanId>('pro')
  const [method, setMethod] = useState<Method>('alipay')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<OrderState | null>(null)
  const [livePlans, setLivePlans] = useState<
    Record<string, { priceCents: number; currency: string }>
  >({})

  useEffect(() => {
    fetch('/api/payments/plans')
      .then((res) => res.json())
      .then((data: { plans?: Array<{ id: string; priceCents: number; currency: string }> }) => {
        if (!data.plans) return
        setLivePlans(
          Object.fromEntries(
            data.plans
              .filter((p) => p.id === 'pro' || p.id === 'commercial')
              .map((p) => [p.id, { priceCents: p.priceCents, currency: p.currency }])
          )
        )
      })
      .catch(() => {
        /* 后端未启动时使用页面默认价格 */
      })
  }, [])

  const plan = PLANS.find((p) => p.id === selected) ?? PLANS[0]
  const livePrice =
    selected === 'pro' || selected === 'commercial'
      ? livePlans[selected]?.priceCents ?? PRICE_FALLBACK[selected]
      : 0
  const priceLabel =
    selected === 'trial' ? '免费' : `¥${(livePrice / 100).toFixed(livePrice % 100 === 0 ? 0 : 2)}`

  const qrSrc = useMemo(() => {
    const qrUrl = order?.qrUrl
    if (!qrUrl) return ''
    if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(qrUrl) || qrUrl.includes('/create-qr-code/')) {
      return qrUrl
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`
  }, [order?.qrUrl])

  useEffect(() => {
    if (!order?.orderId || order.status === 'licensed' || order.status === 'paid') return
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/orders/${order.orderId}`)
        const data = (await res.json()) as {
          status?: string
          licenseKey?: string
        }
        if (data.status === 'licensed' || data.status === 'paid') {
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.status,
                  licenseKey: data.licenseKey ?? prev.licenseKey
                }
              : prev
          )
        }
      } catch {
        /* 网络抖动时继续轮询 */
      }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [order?.orderId, order?.status])

  const selectPlan = (id: PlanId) => {
    setSelected(id)
    setOrder(null)
    setError('')
    document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const startTrial = () => {
    setSelected('trial')
    setOrder(null)
    setError('')
    document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const trimmedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('请填写有效的邮箱地址，用于接收授权信息。')
      return
    }
    setLoading(true)
    setError('')
    setOrder(null)
    try {
      const res = await fetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selected,
          email: trimmedEmail,
          method: selected === 'trial' ? 'alipay' : method,
          customerName: name.trim() || undefined
        })
      })
      const data = (await res.json()) as {
        ok?: boolean
        orderId?: string
        qrUrl?: string
        payUrl?: string
        licenseKey?: string
        error?: string
      }
      if (!res.ok || data.ok === false) {
        setError(mapError(data.error))
        return
      }
      if (data.licenseKey) {
        setOrder({ orderId: data.orderId, licenseKey: data.licenseKey, status: 'licensed' })
        return
      }
      if (data.payUrl) {
        setOrder({ orderId: data.orderId, payUrl: data.payUrl, status: 'awaiting_payment' })
        return
      }
      setOrder({
        orderId: data.orderId,
        qrUrl: data.qrUrl,
        status: 'awaiting_payment'
      })
    } catch {
      setError('暂时无法连接支付服务，请确认支付后端已经启动。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <section className="page-hero price-hero">
        <div className="wrap">
          <span className="kicker">价格方案</span>
          <h1>
            免费使用，按需<span className="grad-text">升级</span>。
          </h1>
          <p className="page-hero-sub">
            核心编辑能力永久免费。付费套餐一次性买断，没有订阅，没有隐藏费用。
          </p>
          <div className="hero-note page-hero-note">
            <span>一次性购买</span>
            <span>永久授权</span>
            <span>支持支付宝 / 微信 / 国际卡</span>
          </div>
        </div>
      </section>

      <section className="block block--top-tight">
        <div className="wrap">
          <div className="plans-grid">
            <div className="plan-tile">
              <div className="plan-tile-head">
                <h3>免费版</h3>
                <span className="plan-price-tag">免费</span>
              </div>
              <p className="plan-tagline">基础 Markdown 编辑器，满足日常写作需求。</p>
              <ul>
                {[
                  '实时预览与源码编辑',
                  'GitHub 风格 Markdown（GFM）',
                  'KaTeX 数学公式',
                  'Mermaid 流程图 / 时序图',
                  '本地保存与 Markdown 导出'
                ].map((f) => (
                  <li key={f}>
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>
              <Link className="btn btn-ghost" href="/download">
                <DownloadIcon />
                免费下载
              </Link>
            </div>

            {PLANS.map((p) => (
              <div className={`plan-tile${p.featured ? ' is-featured' : ''}`} key={p.id}>
                {p.badge && <span className="plan-badge">{p.badge}</span>}
                <div className="plan-tile-head">
                  <h3>{p.name}</h3>
                  <span className="plan-price-tag">
                    ¥{p.price}
                    <small> / 一次性</small>
                  </span>
                </div>
                <p className="plan-tagline">{p.tagline}</p>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <CheckIcon /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => selectPlan(p.id)}
                >
                  立即购买
                </button>
              </div>
            ))}
          </div>

          <div className="trial-bar">
            <div>
              <b>先试后买</b>
              <span>免费申请 14 天 Pro 试用，无需支付方式。</span>
            </div>
            <button type="button" className="btn btn-ghost" onClick={startTrial}>
              申请免费试用
            </button>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="sec-head center reveal">
            <span className="kicker">功能对比</span>
            <h2 className="sec-title">一份对比，选得更明白。</h2>
          </div>
          <div className="compare-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>功能</th>
                  <th>免费版</th>
                  <th>Pro</th>
                  <th>商业版</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['实时预览', true, true, true],
                  ['GFM 支持', true, true, true],
                  ['数学公式 (KaTeX)', true, true, true],
                  ['Mermaid 图表', true, true, true],
                  ['导出 PDF / HTML', false, true, true],
                  ['全部主题 + PlantUML', false, true, true],
                  ['多设备云同步', false, false, true],
                  ['版本历史（30 天）', false, false, true],
                  ['优先技术支持', false, false, true]
                ].map(([label, free, pro, commercial]) => (
                  <tr key={String(label)}>
                    <td>{String(label)}</td>
                    <td>{free ? '✓' : '—'}</td>
                    <td>{pro ? '✓' : '—'}</td>
                    <td>{commercial ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="block" id="checkout">
        <div className="wrap">
          <div className="checkout-layout">
            <div className="order-summary">
              <span className="kicker">下单</span>
              <h2>{selected === 'trial' ? '免费试用' : `${plan.name} 套餐`}</h2>
              <div className="order-price">{priceLabel}</div>
              <p>{selected === 'trial' ? '14 天 Pro 试用授权，到期后自动回到免费版。' : plan.tagline}</p>
              <ul>
                {(selected === 'trial' ? PLANS[0].features : plan.features).map((f) => (
                  <li key={f}>
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>
              <div className="order-security">
                <GitHubIcon />
                授权由 MarkWeave 支付服务签发，订单状态实时同步。
              </div>
            </div>

            <div className="checkout-card">
              {order?.status === 'licensed' ? (
                <div className="pay-success">
                  <span className="success-dot" />
                  <h3>授权已签发</h3>
                  <p>请在桌面端登录同一邮箱，或在应用内粘贴下面的授权密钥。</p>
                  <div className="license-box">
                    <code>{order.licenseKey}</code>
                  </div>
                  <Link className="btn btn-primary" href="/download">
                    下载桌面端
                  </Link>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <h3>{selected === 'trial' ? '申请免费试用' : '确认订单'}</h3>
                  <label className="field">
                    <span>邮箱</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>称呼（选填）</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      placeholder="你的称呼"
                      autoComplete="name"
                    />
                  </label>

                  {selected !== 'trial' && (
                    <div className="pay-methods">
                      <span>支付方式</span>
                      <div className="method-grid">
                        {METHODS.map((m) => (
                          <button
                            type="button"
                            key={m.id}
                            className={`method-btn${method === m.id ? ' is-active' : ''}`}
                            onClick={() => setMethod(m.id)}
                          >
                            <b>{m.label}</b>
                            <small>{m.hint}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="form-error">{error}</p>}
                  <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                    {loading ? '正在创建订单…' : selected === 'trial' ? '免费申请' : `支付 ${priceLabel}`}
                  </button>
                  <p className="checkout-note">
                    {selected === 'trial'
                      ? '提交后我们会立刻为你签发试用授权，不会收取任何费用。'
                      : '提交后将生成支付二维码或收银台链接。订单 15 分钟内有效。'}
                  </p>
                </form>
              )}

              {order?.qrUrl && order.status !== 'licensed' && (
                <div className="qr-stage">
                  <span className="qr-title">请使用手机扫码支付</span>
                  <img src={qrSrc} alt="支付二维码" width={240} height={240} />
                  <div className="order-meta">
                    <span>订单号：{order.orderId}</span>
                    <span>状态：等待支付</span>
                  </div>
                  <p>支付完成后页面会自动检测结果，通常几秒内完成。</p>
                </div>
              )}

              {order?.payUrl && order.status !== 'licensed' && (
                <div className="qr-stage">
                  <span className="qr-title">国际卡支付</span>
                  <p>已为你创建 Creem 收银台，点击下方按钮前往支付。</p>
                  <a className="btn btn-primary" href={order.payUrl} target="_blank" rel="noopener noreferrer">
                    前往支付
                  </a>
                  <div className="order-meta">
                    <span>订单号：{order.orderId}</span>
                    <span>状态：等待支付</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function mapError(code?: string): string {
  const messages: Record<string, string> = {
    BAD_REQUEST: '下单参数有误，请检查后重试。',
    UNKNOWN_PLAN: '当前套餐不存在，请刷新页面。',
    ALIPAY_NOT_CONFIGURED: '支付宝尚未配置，请选择其他支付方式。',
    WECHAT_ERROR: '微信支付暂时不可用，请稍后重试。',
    CREEM_PRODUCT_NOT_CONFIGURED: '国际卡支付尚未配置。',
    PAYMENT_SERVICE_UNAVAILABLE: '支付服务未连接，请确认后端已启动。'
  }
  return code ? messages[code] ?? `下单失败：${code}` : '下单失败，请稍后重试。'
}
