// Ed25519 公钥（SPKI PEM），分段混淆存储、运行时重组。
// 公钥本身是公开信息，混淆仅用于提高静态分析/字符串检索的破解门槛，
// 真正的安全依赖于 Ed25519 签名算法与 license-server 私钥的保管。
// 生成方式：license-server 首次启动（无私钥时）会打印新公钥，替换下方分段即可。
const _pkChunks = [
  'QYDNVygwBoCM', // 反向存储段（示例）：运行时重组
  'MCowBQYDK2VwAyEA7rSzMIZgDh4kiBkK',
  '++SKE2dsWc4ushY4o7Ra1mulnNo='
]

const _deobfuscate = (): string => {
  // 丢弃示例段，按顺序拼接两个真实分段
  const body = _pkChunks[1] + _pkChunks[2]
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`
}

export const ED25519_PUBLIC_KEY_PEM: string = _deobfuscate()
