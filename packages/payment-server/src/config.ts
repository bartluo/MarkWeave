export interface PaymentServerConfig {
  port: number
  dbPath: string
  licenseServerUrl: string
  licenseAdminKey: string
  authServerUrl: string
  authServerAdminKey: string
  trustProxy: boolean
  // 支付宝
  alipayAppId: string
  alipayPrivateKey: string
  alipayAlipayPublicKey: string
  alipayGateway: string
  alipayNotifyUrl: string
  // 微信支付
  wechatAppId: string
  wechatMchId: string
  wechatApiKey: string
  wechatNotifyUrl: string
  wechatCertPrivateKeyPath?: string
  // Creem
  creemApiKey: string
  creemWebhookSecret: string
  creemServer: 'prod' | 'test'
  // Creem 产品 ID（在 Creem Dashboard 中创建）
  creemProProductId: string
  creemCommercialProductId: string
  creemTrialProductId: string
}

export function loadConfig(): PaymentServerConfig {
  const env = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v ?? ''])
  )
  return {
    port: parseInt(env.PORT ?? '3220', 10),
    dbPath: env.PAYMENT_DB_PATH ?? './data/payment.db',
    licenseServerUrl: env.LICENSE_SERVER_URL ?? 'http://localhost:3210',
    licenseAdminKey: env.LICENSE_ADMIN_KEY ?? '',
    authServerUrl: env.AUTH_SERVER_URL ?? 'http://localhost:3230',
    authServerAdminKey: env.AUTH_ADMIN_KEY ?? '',
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    alipayAppId: env.ALIPAY_APP_ID ?? '',
    alipayPrivateKey: env.ALIPAY_PRIVATE_KEY ?? '',
    alipayAlipayPublicKey: env.ALIPAY_ALIPAY_PUBLIC_KEY ?? '',
    alipayGateway: env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do',
    alipayNotifyUrl: env.ALIPAY_NOTIFY_URL ?? '',
    wechatAppId: env.WECHAT_APP_ID ?? '',
    wechatMchId: env.WECHAT_MCH_ID ?? '',
    wechatApiKey: env.WECHAT_API_KEY ?? '',
    wechatNotifyUrl: env.WECHAT_NOTIFY_URL ?? '',
    wechatCertPrivateKeyPath: env.WECHAT_CERT_PRIVATE_KEY_PATH,
    creemApiKey: env.CREEM_API_KEY ?? '',
    creemWebhookSecret: env.CREEM_WEBHOOK_SECRET ?? '',
    creemServer: (env.CREEM_SERVER ?? 'prod') as 'prod' | 'test',
    creemProProductId: env.CREEM_PRODUCT_PRO ?? '',
    creemCommercialProductId: env.CREEM_PRODUCT_COMMERCIAL ?? '',
    creemTrialProductId: env.CREEM_PRODUCT_TRIAL ?? ''
  }
}
