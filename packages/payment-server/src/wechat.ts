import crypto from 'node:crypto'

/**
 * 微信支付 v1 签名（MD5）
 * 参数按 key 字典序排序后拼接 key=商户密钥，再 MD5 取大写
 */
export function createPaySignature(params: Record<string, string>, apiKey: string): string {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const signStr = `${sorted}&key=${apiKey}`
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase()
}

/**
 * 构建 WeChat Pay v3 webhook 验签输入串
 * 格式：timestamp + "\n" + nonce + "\n" + body + "\n"
 */
export function buildWechatV3SignInput(timestamp: string, nonce: string, body: string): string {
  return `${timestamp}\n${nonce}\n${body}\n`
}

/**
 * 微信支付 v3 HMAC-SHA256 验签
 * 用于 v3 风格回调（Wechatpay-Signature 头），使用商户 API v3 密钥（32位字符串）
 * 注意：微信官方 v3 通知解密使用 ECDSA-SHA256 + 平台证书，此函数用于自定义 v3 风格验签场景。
 * 如需完整 v3 验签，需配合 wechatpay-v3 库使用平台证书公钥。
 */
export function verifyWechatV3HmacSignature(
  message: string,
  signature: string,
  apiKey: string
): boolean {
  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(message, 'utf8')
    .digest('base64')
  return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))
}

/**
 * 随机字符串
 */
export function randomString(length = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

/**
 * Unix 时间戳（秒）
 */
export function timestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

/**
 * 将 WeChat Pay XML 响应解析为 Record
 */
export function parseWechatXmlResponse(xml: string): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /<(\w+)><!\[CDATA\[([^\]]*)\]\]><\/\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) result[m[1]] = m[2]
  return result
}

/**
 * 将 WeChat Pay XML 请求体转为字符串（带 CDATA）
 */
export function buildWechatXml(params: Record<string, string>): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`)
    .join('\n')
  return `<xml>${pairs}\n</xml>`
}

/**
 * 将 code_url 转为 QR 码图片 URL（使用 Google Charts API）
 * 也可替换为本地 qrcode 包生成 base64
 */
export function codeUrlToQrUrl(codeUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(codeUrl)}`
}
