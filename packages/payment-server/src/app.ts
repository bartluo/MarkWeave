import crypto from 'node:crypto'
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { AlipaySdk } from 'alipay-sdk'
import type { AlipaySdkCommonResult } from 'alipay-sdk'
import { Creem } from 'creem'
import {
  createPaySignature,
  verifyWechatV3HmacSignature,
  buildWechatV3SignInput,
  randomString,
  timestamp,
  parseWechatXmlResponse,
  buildWechatXml,
  codeUrlToQrUrl
} from './wechat.js'
import type { OrderRow, PaymentMethod, PaymentPlan, PlanConfig } from './db/types.js'
import type { Store } from './db/index.js'
import type { PaymentServerConfig } from './config.js'
import { z } from 'zod'
import { decodeKey, keyIdOfPayload } from '@markweave/license-core'

const createOrderSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['pro', 'commercial', 'trial']),
  method: z.enum(['alipay', 'wechat', 'creem', 'manual']).optional(),
  customerName: z.string().max(128).optional()
})

function toPlanResponse(p: PaymentPlan) {
  return {
    id: p.id,
    displayName: p.displayName,
    priceCents: p.priceCents,
    currency: p.currency,
    billingCycle: p.billingCycle,
    description: p.description
  }
}

function toOrderResponse(o: OrderRow) {
  return {
    id: o.id,
    status: o.status,
    plan: o.plan,
    amountCents: o.amount_cents,
    currency: o.currency,
    email: o.customer_email,
    licenseKey: o.license_key ?? undefined,
    createdAt: o.created_at,
    paidAt: o.license_issued_at ?? undefined
  }
}

export const createApp = (store: Store, cfg: PaymentServerConfig, plans: PlanConfig): Hono => {
  // ── 支付宝客户端 ──
  let alipaySdk: AlipaySdk | null = null
  if (cfg.alipayAppId && cfg.alipayPrivateKey) {
    alipaySdk = new AlipaySdk({
      appId: cfg.alipayAppId,
      privateKey: cfg.alipayPrivateKey,
      alipayPublicKey: cfg.alipayAlipayPublicKey,
      gateway: cfg.alipayGateway,
      signType: 'RSA2'
    })
  }

  // ── Creem 客户端 ──
  const creem = new Creem({
    apiKey: cfg.creemApiKey,
    server: cfg.creemServer
  })

  const app = new Hono()

  // ── 健康检查 ──
  app.get('/v1/health', (c) => c.json({ ok: true, ts: Date.now() }))

  // ── 套餐列表 ──
  app.get('/v1/plans', (c) =>
    c.json({ plans: Object.values(plans).map(toPlanResponse) })
  )

  // ── 创建订单 ──
  app.post('/v1/orders', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'BAD_REQUEST' }, 400)
    const { email, plan, method = 'alipay', customerName } = parsed.data
    const paymentPlan = plans[plan]
    if (!paymentPlan) return c.json({ error: 'UNKNOWN_PLAN' }, 400)

    // 免费套餐直接签发
    if (paymentPlan.priceCents === 0) {
      const order = store.createOrder({
        customer_email: email,
        customer_name: customerName ?? null,
        plan,
        amount_cents: 0,
        currency: paymentPlan.currency,
        status: 'licensed',
        payment_method: 'manual'
      })
      await issueLicenseForOrder(store, cfg, order, plan, email)
      return c.json({ ok: true, orderId: order.id, licenseKey: order.license_key })
    }

    const paymentMethod: PaymentMethod =
      method === 'wechat' ? 'wechat'
      : method === 'creem' ? 'creem'
      : 'alipay'

    const order = store.createOrder({
      customer_email: email,
      customer_name: customerName ?? null,
      plan,
      amount_cents: paymentPlan.priceCents,
      currency: paymentPlan.currency,
      status: 'awaiting_payment',
      payment_method: paymentMethod
    })

    if (paymentMethod === 'alipay') {
      if (!alipaySdk) return c.json({ error: 'ALIPAY_NOT_CONFIGURED' }, 500)
      const qrResult = await createAlipayQr(alipaySdk, cfg, order, paymentPlan)
      if (qrResult.error) return c.json({ ok: false, error: qrResult.error }, 500)
      store.updateOrder(order.id, {
        alipay_trade_no: qrResult.tradeNo ?? null,
        alipay_user_id: qrResult.userId ?? null
      })
      return c.json({
        ok: true,
        orderId: order.id,
        qrUrl: qrResult.qrUrl
      })
    }

    if (paymentMethod === 'wechat') {
      const qrResult = await createWechatOrder(cfg, order, paymentPlan)
      if (qrResult.error) return c.json({ ok: false, error: qrResult.error }, 500)
      store.updateOrder(order.id, {
        wechat_prepay_id: qrResult.prepayId ?? null,
        wechat_code_url: qrResult.codeUrl ?? null
      })
      return c.json({
        ok: true,
        orderId: order.id,
        qrUrl: qrResult.qrUrl
      })
    }

    if (paymentMethod === 'creem') {
      if (!cfg.creemWebhookSecret) {
        return c.json({ error: 'CREEM_WEBHOOK_SECRET_NOT_CONFIGURED' }, 500)
      }
      const creemResult = await createCreemCheckout(cfg, creem, order, paymentPlan)
      if (creemResult.error) return c.json({ ok: false, error: creemResult.error }, 500)
      store.updateOrder(order.id, {
        creem_checkout_id: creemResult.checkoutId ?? null,
        creem_request_id: creemResult.requestId ?? null
      })
      return c.json({ ok: true, orderId: order.id, payUrl: creemResult.checkoutUrl })
    }

    return c.json({ error: 'UNKNOWN_METHOD' }, 400)
  })

  // ── 查询订单 ──
  app.get('/v1/orders/:orderId', (c) => {
    const order = store.getOrderById(c.req.param('orderId'))
    if (!order) return c.json({ error: 'NOT_FOUND' }, 404)
    return c.json(toOrderResponse(order))
  })

  // ── 支付宝异步通知 ──
  app.post('/v1/webhooks/alipay', async (c) => {
    if (!alipaySdk || !cfg.alipayAlipayPublicKey) {
      return c.json({ result: 'failure' }, 400)
    }
    const body = await c.req.text()
    const params = new URLSearchParams(body)
    const success = alipaySdk.checkNotifySign(params)
    if (!success) {
      console.warn('[alipay] signature verification failed')
      return c.json({ result: 'failure' })
    }
    const tradeStatus = params.get('trade_status')
    const tradeNo = params.get('trade_no')
    const buyerId = params.get('buyer_id')
    const outTradeNo = params.get('out_trade_no')
    if (!tradeNo || !outTradeNo) return c.json({ result: 'failure' })
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return c.json({ result: 'success' })
    }
    const order = store.getOrderById(outTradeNo) ?? store.getOrderAlipay(tradeNo)
    if (!order || order.status === 'licensed' || order.status === 'paid') {
      return c.json({ result: 'success' })
    }
    store.updateOrder(order.id, {
      status: 'paid',
      alipay_trade_no: tradeNo,
      alipay_user_id: buyerId ?? null,
      updated_at: Date.now()
    })
    await issueLicenseForOrder(store, cfg, order, order.plan, order.customer_email)
    return c.json({ result: 'success' })
  })

  // ── 微信支付异步通知 ──
  app.post('/v1/webhooks/wechat', async (c) => {
    const xmlBody = await c.req.text()
    const result = parseWechatXmlResponse(xmlBody)
    if (!result.out_trade_no || !result.prepay_id) {
      return wechatFailResponse()
    }
    // v3 验签：Wechatpay-Signature 头包含 algorithm, serial, nonce, timestamp, signature
    const wechatpaySig = c.req.header('Wechatpay-Signature') ?? ''
    if (wechatpaySig) {
      const ts = c.req.header('Wechatpay-Timestamp') ?? ''
      const nonce = c.req.header('Wechatpay-Nonce') ?? ''
      const sigInput = buildWechatV3SignInput(ts, nonce, xmlBody)
      if (!verifyWechatV3HmacSignature(sigInput, wechatpaySig, cfg.wechatApiKey)) {
        console.warn('[wechat] signature mismatch')
        return wechatFailResponse()
      }
    }
    if (result.result_code !== 'SUCCESS') {
      return wechatFailResponse()
    }
    const order = store.getOrderWechat(result.prepay_id) ?? store.getOrderById(result.out_trade_no)
    if (!order || order.status === 'licensed' || order.status === 'paid') {
      return wechatSuccessResponse()
    }
    store.updateOrder(order.id, {
      status: 'paid',
      wechat_prepay_id: result.prepay_id,
      updated_at: Date.now()
    })
    await issueLicenseForOrder(store, cfg, order, order.plan, order.customer_email)
    return wechatSuccessResponse()
  })

  // ── Creem 异步通知 ──
  app.post('/v1/webhooks/creem', async (c) => {
    const rawBody = await c.req.text()
    const sigHeader = c.req.header('creem-signature') ?? ''
    // 必须验签：配置了 secret 就必须提供签名，否则拒绝
    if (cfg.creemWebhookSecret && !sigHeader) {
      return c.json({ error: 'MISSING_SIGNATURE' }, 400)
    }
    if (sigHeader) {
      const expected = crypto
        .createHmac('sha256', cfg.creemWebhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex')
      if (!crypto.timingSafeEqual(Buffer.from(sigHeader, 'utf8'), Buffer.from(expected, 'utf8'))) {
        console.warn('[creem] webhook signature mismatch')
        return c.json({ error: 'INVALID_SIGNATURE' }, 400)
      }
    }
    let event: { type: string; data?: Record<string, unknown> }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return c.json({ error: 'BAD_JSON' }, 400)
    }
    try {
      switch (event.type) {
        case 'checkout.completed': {
          const data = event.data ?? {}
          const requestId = (data.request_id ?? data.requestId ?? '') as string
          const checkoutId = (data.checkout_id ?? data.checkoutId ?? '') as string
          if (!requestId) {
            console.warn('[creem] checkout.completed without request_id')
            return c.json({ received: true })
          }
          const order = store.getOrderCreemRequestId(requestId) ?? store.getOrderCreem(checkoutId)
          if (!order || order.status === 'licensed' || order.status === 'paid') {
            return c.json({ received: true })
          }
          store.updateOrder(order.id, {
            status: 'paid',
            creem_checkout_id: checkoutId || order.creem_checkout_id,
            updated_at: Date.now()
          })
          await issueLicenseForOrder(store, cfg, order, order.plan, order.customer_email)
          break
        }
        case 'refund.created': {
          const data = event.data ?? {}
          const refundId = (data.refund_id ?? data.id ?? '') as string
          const checkoutId = (data.checkout_id ?? data.checkoutId ?? '') as string
          const order = store.getOrderCreem(checkoutId)
          if (order) {
            store.updateOrder(order.id, { status: 'refunded', refunded_at: Date.now() })
            store.createRefund({
              order_id: order.id,
              amount_cents: order.amount_cents,
              reason: null,
              payment_method: 'creem',
              creem_refund_id: refundId,
              status: 'pending'
            })
            // 防盗版：退款后联动吊销已签发的许可证
            await revokeLicenseForOrder(cfg, order)
          }
          break
        }
        default:
          break
      }
    } catch (err) {
      console.error('[creem] webhook handler error:', err)
      return c.json({ error: 'HANDLER_ERROR' }, 500)
    }
    return c.json({ received: true })
  })

  // ── 管理员接口 ──
  app.use('/v1/admin/*', async (c, next) => {
    if (!cfg.licenseAdminKey || c.req.header('Authorization') !== `Bearer ${cfg.licenseAdminKey}`) {
      return c.json({ error: 'UNAUTHORIZED' }, 401)
    }
    await next()
  })

  app.get('/v1/admin/orders', (c) => {
    const status = c.req.query('status')
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10), 1), 500)
    return c.json({ orders: store.listOrders(status ?? undefined, limit) })
  })

  app.post('/v1/admin/orders/:orderId/refund', async (c) => {
    const order = store.getOrderById(c.req.param('orderId'))
    if (!order) return c.json({ error: 'NOT_FOUND' }, 404)
    if (order.status !== 'paid' && order.status !== 'licensed') {
      return c.json({ error: 'NOT_PAYABLE' }, 400)
    }
    store.createRefund({
      order_id: order.id,
      amount_cents: order.amount_cents,
      reason: null,
      payment_method: order.payment_method,
      status: 'pending'
    })
    store.updateOrder(order.id, { status: 'refunded', refunded_at: Date.now() })
    // 防盗版：退款后联动吊销已签发的许可证
    await revokeLicenseForOrder(cfg, order)
    return c.json({ ok: true })
  })

  return app
}

// ── 支付宝当面付（生成付款二维码） ──
async function createAlipayQr(
  sdk: AlipaySdk,
  _cfg: PaymentServerConfig,
  order: OrderRow,
  paymentPlan: PaymentPlan
): Promise<{ qrUrl?: string; tradeNo?: string; userId?: string; error?: string }> {
  try {
    const result = await sdk.exec('alipay.trade.precreate', {
      bizContent: {
        out_trade_no: order.id,
        total_amount: (paymentPlan.priceCents / 100).toFixed(2),
        subject: `${paymentPlan.displayName} - ${order.customer_email}`,
        timeout_express: '15m'
      }
    }) as AlipaySdkCommonResult
    const bizResult = result.data as Record<string, string>
    const qrCode = bizResult?.qr_code ?? ''
    if (!qrCode) {
      console.error('[alipay] precreate returned empty qr_code:', bizResult)
      return { error: 'ALIPAY_ERROR' }
    }
    return { qrUrl: qrCode, tradeNo: bizResult?.trade_no, userId: bizResult?.buyer_user_id }
  } catch (err) {
    console.error('[alipay] precreate failed:', err)
    return { error: 'ALIPAY_ERROR' }
  }
}

// ── 微信支付统一下单（NATIVE 模式，返回 code_url） ──
async function createWechatOrder(
  cfg: PaymentServerConfig,
  order: OrderRow,
  paymentPlan: PaymentPlan
): Promise<{ qrUrl?: string; prepayId?: string; codeUrl?: string; error?: string }> {
  try {
    const params: Record<string, string> = {
      appid: cfg.wechatAppId,
      mch_id: cfg.wechatMchId,
      nonce_str: randomString(32),
      body: `${paymentPlan.displayName} - ${order.customer_email}`,
      out_trade_no: order.id,
      total_fee: paymentPlan.priceCents.toString(),
      spbill_create_ip: '127.0.0.1',
      notify_url: cfg.wechatNotifyUrl,
      trade_type: 'NATIVE'
    }
    const sign = createPaySignature(params, cfg.wechatApiKey)
    const xmlPayload = buildWechatXml({ ...params, sign })
    const resp = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlPayload
    })
    const xmlText = await resp.text()
    const data = parseWechatXmlResponse(xmlText)
    if (data.return_code !== 'SUCCESS' || data.result_code !== 'SUCCESS') {
      console.error('[wechat] unifiedorder failed:', data)
      return { error: data.err_code_des ?? 'WECHAT_ERROR' }
    }
    const codeUrl = data.code_url ?? ''
    return { qrUrl: codeUrlToQrUrl(codeUrl), prepayId: data.prepay_id, codeUrl }
  } catch (err) {
    console.error('[wechat] order creation failed:', err)
    return { error: 'WECHAT_ERROR' }
  }
}

// ── Creem：创建 Checkout Session ──
async function createCreemCheckout(
  cfg: PaymentServerConfig,
  creem: Creem,
  order: OrderRow,
  paymentPlan: PaymentPlan
): Promise<{ checkoutUrl?: string; checkoutId?: string; requestId?: string; error?: string }> {
  try {
    const productId = paymentPlan.id === 'pro' ? cfg.creemProProductId
      : paymentPlan.id === 'commercial' ? cfg.creemCommercialProductId
      : cfg.creemTrialProductId
    if (!productId) {
      console.error(`[creem] missing product ID for plan: ${paymentPlan.id}`)
      return { error: 'CREEM_PRODUCT_NOT_CONFIGURED' }
    }
    // Creem API: successUrl 和 cancelUrl 是可选的
    const createParams: Record<string, unknown> = {
      productId,
      requestId: order.id
    }
    if (cfg.licenseServerUrl) {
      createParams.successUrl = `${cfg.licenseServerUrl}/v1/payments/success?order_id=${order.id}`
    }
    // Try known Creem SDK method names; fall back to a raw POST if none match
    const creemAny = creem as unknown as Record<string, unknown>
    type CreemCheckout = { id: string; checkoutUrl: string }
    let checkout: CreemCheckout
    const checkoutsObj = creemAny.checkouts as Record<string, unknown> | null | undefined
    if (checkoutsObj && typeof checkoutsObj.create === 'function') {
      checkout = await (checkoutsObj.create as (p: Record<string, unknown>) => Promise<CreemCheckout>)(createParams)
    } else if (typeof creemAny.createCheckout === 'function') {
      checkout = await (creemAny.createCheckout as (p: Record<string, unknown>) => Promise<CreemCheckout>)(createParams)
    } else {
      checkout = await rawCreemCheckout(cfg, createParams)
    }
    return { checkoutUrl: checkout.checkoutUrl, checkoutId: checkout.id, requestId: order.id }
  } catch (err) {
    console.error('[creem] checkout creation failed:', err)
    return { error: 'CREEM_ERROR' }
  }
}

// ── Creem raw POST fallback ──
async function rawCreemCheckout(
  cfg: PaymentServerConfig,
  params: Record<string, unknown>
): Promise<{ id: string; checkoutUrl: string }> {
  const res = await fetch('https://api.creem.io/v1/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.creemApiKey}`
    },
    body: JSON.stringify(params)
  })
  const data = await res.json() as { id?: string; checkoutUrl?: string; error?: string }
  if (!data.id || !data.checkoutUrl) throw new Error(data.error ?? 'CREEM_API_ERROR')
  return { id: data.id, checkoutUrl: data.checkoutUrl }
}

// ── 退款联动吊销许可证 ──
async function revokeLicenseForOrder(cfg: PaymentServerConfig, order: OrderRow): Promise<void> {
  if (!order.license_key) return
  try {
    const decoded = decodeKey(order.license_key)
    if (!decoded) return
    const keyId = keyIdOfPayload(decoded.payload)
    const res = await fetch(`${cfg.licenseServerUrl}/v1/admin/licenses/${keyId}/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.licenseAdminKey}`
      },
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) {
      console.error('[license] revoke failed for order', order.id, res.status)
    }
  } catch (err) {
    console.error('[license] revoke server unreachable for order', order.id, err)
  }
}

// ── 签发许可证 ──
async function issueLicenseForOrder(
  store: Store,
  cfg: PaymentServerConfig,
  order: OrderRow,
  plan: string,
  email: string
): Promise<void> {
  const expiresInDays = plan === 'trial' ? 14 : 0
  const body = JSON.stringify({
    email,
    plan,
    machineLimit: plan === 'commercial' ? 3 : 1,
    expiresAt: expiresInDays * 86400,
    orderId: order.id
  })
  try {
    const res = await fetch(`${cfg.licenseServerUrl}/v1/admin/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.licenseAdminKey}`
      },
      body,
      signal: AbortSignal.timeout(30_000)
    })
    const data = await res.json() as { ok?: boolean; key?: string; error?: string }
    if (data.ok && data.key) {
      store.updateOrder(order.id, {
        status: 'licensed',
        license_key: data.key,
        license_issued_at: Date.now(),
        updated_at: Date.now()
      })
      // 支付完成：通知 auth-server 写入 user_plans 记录
      await activatePlanInAuthServer(cfg, order, data.key, plan)
    } else {
      console.error('[license] issuance failed for order', order.id, data.error)
      store.updateOrder(order.id, {
        status: 'license_failed',
        updated_at: Date.now()
      })
    }
  } catch (err) {
    console.error('[license] server unreachable for order', order.id, err)
    store.updateOrder(order.id, {
      status: 'license_failed',
      updated_at: Date.now()
    })
  }
}

// ── 激活 auth-server 中的用户计划 ──
async function activatePlanInAuthServer(
  cfg: PaymentServerConfig,
  order: OrderRow,
  licenseKey: string,
  plan: string
): Promise<void> {
  if (!cfg.authServerUrl || !cfg.authServerAdminKey) return
  try {
    const keyParts = licenseKey.split('.')
    const licenseKeyId = keyParts[1] ?? licenseKey
    const expiresInDays = plan === 'trial' ? 14 : 365
    const body = JSON.stringify({
      email: order.customer_email,
      plan,
      licenseKeyId,
      orderId: order.id,
      expiresAt: order.plan === 'trial' ? undefined : Math.floor(Date.now() / 1000) + expiresInDays * 86400
    })
    const res = await fetch(`${cfg.authServerUrl}/v1/admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.authServerAdminKey}`
      },
      body,
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) {
      console.warn('[auth-server] plan activation failed for order', order.id, res.status)
    } else {
      console.info('[auth-server] plan activated for order', order.id, 'plan=', plan, 'email=', order.customer_email)
    }
  } catch (err) {
    console.warn('[auth-server] plan activation error for order', order.id, err)
  }
}

// ── 微信 XML 响应 ──
function wechatSuccessResponse(): Response {
  return new Response('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>', {
    headers: { 'Content-Type': 'application/xml' }
  })
}

function wechatFailResponse(): Response {
  return new Response('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名失败]]></return_msg></xml>', {
    headers: { 'Content-Type': 'application/xml' }
  })
}
