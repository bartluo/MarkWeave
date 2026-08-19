import { generateKeyPairSync, createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

export interface KeyPair {
  privateKey: KeyObject
  publicKey: KeyObject
}

/**
 * 加载或创建 Ed25519 密钥对。
 *
 * 密钥优先级（生产环境安全第一）：
 *   1. 环境变量 LICENSE_PRIVATE_KEY —— 推荐生产使用，避免私钥写入磁盘/仓库
 *   2. 环境变量 LICENSE_PRIVATE_KEY_PATH 指向的 PEM 文件
 *   3. 默认路径 ./data/license-private.pem 下的 PEM 文件
 *   4. 全部缺失时生成新密钥并写入默认路径（开发环境用）
 *
 * 注意：私钥绝不可提交进版本仓库（见 .gitignore）。客户端内置公钥
 * 必须与私钥一一对应；轮换私钥时需同步更新 desktop 的 publicKey.ts。
 */
export const loadOrCreateKeyPair = (pemPath: string): KeyPair => {
  const fromEnv = process.env.LICENSE_PRIVATE_KEY
  if (fromEnv) {
    try {
      const privateKey = createPrivateKey(fromEnv)
      return { privateKey, publicKey: createPublicKey(privateKey) }
    } catch (err) {
      console.error('[license-server] 环境变量 LICENSE_PRIVATE_KEY 不是有效的 Ed25519 私钥:', err)
    }
  }

  const explicitPath = process.env.LICENSE_PRIVATE_KEY_PATH
  const candidates = [explicitPath, pemPath].filter((p): p is string => !!p)
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      try {
        const privateKey = createPrivateKey(readFileSync(candidate))
        return { privateKey, publicKey: createPublicKey(privateKey) }
      } catch (err) {
        console.error(`[license-server] 读取私钥文件失败 ${candidate}:`, err)
      }
    }
  }

  console.warn('[license-server] 未找到私钥，正在生成新的 Ed25519 密钥对…')
  const dir = dirname(pemPath)
  mkdirSync(dir, { recursive: true })
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  // 以 0600 权限写入，避免被其他用户读取
  writeFileSync(pemPath, pem, { mode: 0o600 })
  console.warn('[license-server] 已生成新私钥并写入', pemPath)
  console.warn('[license-server] 新公钥（请同步到 desktop/src/main/license/publicKey.ts）:')
  console.warn(publicKey.export({ type: 'spki', format: 'pem' }).toString())
  return { privateKey, publicKey }
}
