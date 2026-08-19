export type OrderPlan = 'pro' | 'commercial' | 'trial'
export type PaymentMethod = 'alipay' | 'wechat' | 'creem' | 'manual'
export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'licensed'
  | 'license_failed'
  | 'refunded'
  | 'cancelled'
  | 'expired'

export interface PaymentPlan {
  id: OrderPlan
  displayName: string
  priceCents: number
  currency: string
  billingCycle: 'one_time'
  description: string
}

export interface OrderRow {
  id: string
  customer_email: string
  customer_name?: string | null
  plan: OrderPlan
  amount_cents: number
  currency: string
  status: OrderStatus
  payment_method: PaymentMethod
  // 支付宝字段
  alipay_trade_no?: string | null       // 支付宝交易号
  alipay_user_id?: string | null       // 支付宝用户 ID
  // 微信支付字段
  wechat_prepay_id?: string | null     // 微信 prepay_id
  wechat_code_url?: string | null      // 微信付款码 URL（用于生成 QR）
  // Creem 字段
  creem_checkout_id?: string | null    // Creem checkout session ID
  creem_request_id?: string | null     // Creem requestId（对应我们的 orderId）
  // 通用
  license_key?: string | null
  license_issued_at?: number | null
  refunded_at?: number | null
  created_at: number
  updated_at: number
}

export interface RefundRow {
  id: string
  order_id: string
  amount_cents: number
  reason?: string | null
  payment_method: PaymentMethod
  third_party_refund_id?: string | null
  creem_refund_id?: string | null
  status: 'pending' | 'succeeded' | 'failed'
  created_at: number
}

export interface PlanConfig {
  pro: PaymentPlan
  commercial: PaymentPlan
  trial: PaymentPlan
}

export const DEFAULT_PLANS: PlanConfig = {
  pro: {
    id: 'pro',
    displayName: 'MarkWeave Pro',
    priceCents: 3900,
    currency: 'CNY',
    billingCycle: 'one_time',
    description: '一次性购买，永久使用 Pro 功能'
  },
  commercial: {
    id: 'commercial',
    displayName: 'MarkWeave Commercial',
    priceCents: 19900,
    currency: 'CNY',
    billingCycle: 'one_time',
    description: '一次性购买，永久使用全部功能（含云同步）'
  },
  trial: {
    id: 'trial',
    displayName: 'MarkWeave Trial',
    priceCents: 0,
    currency: 'CNY',
    billingCycle: 'one_time',
    description: '14 天免费试用'
  }
}
