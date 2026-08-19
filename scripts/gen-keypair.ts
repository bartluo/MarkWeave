import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * 生成新的 Ed25519 密钥对，并输出供嵌入客户端的公钥分段。
 *
 * 用法：
 *   pnpm exec tsx scripts/gen-keypair.ts [--write]
 *
 * 说明：
 *   - 默认只打印私钥/公钥 PEM 与公钥分段，不写盘（安全默认）。
 *   - 加 --write 会把私钥写入 packages/license-server/data/license-private.pem
 *     （0600 权限），并将公钥写入 license-public.pem。
 *   - 生成后必须把打印的"公钥分段"更新到 desktop/src/main/license/publicKey.ts，
 *     否则客户端将无法验证新私钥签发的许可证。
 */
const writeFiles = process.argv.includes('--write')
const privatePath = resolve('packages/license-server/data/license-private.pem')
const publicPath = resolve('packages/license-server/data/license-public.pem')

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim()
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim()
const pubBody = pubPem.replace(/-----BEGIN PUBLIC KEY-----|\n|-----END PUBLIC KEY-----/g, '')
const half = Math.ceil(pubBody.length / 2)
const chunk1 = pubBody.slice(0, half)
const chunk2 = pubBody.slice(half)

if (writeFiles) {
  mkdirSync(dirname(privatePath), { recursive: true })
  writeFileSync(privatePath, `${privPem}\n`, { mode: 0o600 })
  writeFileSync(publicPath, `${pubPem}\n`, { mode: 0o600 })
  console.log(`已写入:\n  ${privatePath}\n  ${publicPath}`)
}

console.log('\n=== 私钥 PEM (PKCS8) ===')
console.log(privPem)
console.log('\n=== 公钥 PEM (SPKI) ===')
console.log(pubPem)
console.log('\n=== 公钥分段（更新到 publicKey.ts 的 _pkChunks） ===')
console.log(`  '${chunk1}',`)
console.log(`  '${chunk2}'`)
