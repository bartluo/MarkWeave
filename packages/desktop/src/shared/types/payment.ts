export type PaymentPlan = 'pro' | 'commercial' | 'trial'
export type PaymentMethod = 'alipay' | 'wechat' | 'creem' | 'manual'
export type PaymentStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'licensed'
  | 'license_failed'
  | 'refunded'
  | 'cancelled'
  | 'expired'

export interface PaymentPlanInfo {
  id: PaymentPlan
  displayName: string
  priceCents: number
  currency: string
  billingCycle: 'one_time'
  description: string
}

export interface OrderInfo {
  id: string
  status: PaymentStatus
  plan: PaymentPlan
  amountCents: number
  currency: string
  email?: string
  licenseKey?: string
  paymentMethod?: PaymentMethod
  createdAt: number
  paidAt?: number
}

export interface CheckoutResult {
  ok: true
  orderId: string
  /** 支付宝：跳转支付 URL */
  payUrl?: string
  /** 微信：付款码 URL（weixin://wxpay/bizpayurl?...） */
  qrUrl?: string
  licenseKey?: string
}

export interface CheckoutError {
  ok: false
  error: string
}

export type CheckoutOutcome = CheckoutResult | CheckoutError
