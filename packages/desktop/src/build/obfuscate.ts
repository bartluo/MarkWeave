import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import obfuscator from 'javascript-obfuscator'
import type { Plugin } from 'vite'

/**
 * 构建后混淆插件（仅生产构建生效）。
 *
 * 用途：防止反编译/静态分析。重点保护主进程与 preload 中的许可证验证逻辑
 * （Ed25519 验签、公钥、hasFeature 门控、导出拦截），这些是防盗版的核心执行层。
 *
 * 说明：客户端侧混淆并非绝对安全（任何运行在用户机器的代码都可通过
 * 动态调试最终还原），但能显著提高破解成本，阻止简单的 asar 解包 + 文本检索。
 *
 * 注意：
 *   - renameGlobals: false —— 必须保留，避免破坏 CJS 的 module/exports/require/process
 *   - renameProperties: false —— 避免重命名对象属性破坏运行时行为
 *   - 不启用 selfDefending/debugProtection —— 避免合法调试与兼容性问题
 */
// javascript-obfuscator type exports are incomplete; use type assertion
const OBJ_OPTIONS: Record<string, unknown> = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.3,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.95,
  splitStrings: true,
  splitStringsChunkLength: 10,
  numbersToExpressions: true,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false
}

export function obfuscateBundle(outDir: string, bundleFile: string): Plugin {
  return {
    name: 'markweave:obfuscate-bundle',
    apply: (_config, env) => env.mode === 'production' && env.command === 'build',
    enforce: 'post',
    closeBundle() {
      const filePath = resolve(outDir, bundleFile)
      let code: string
      try {
        code = readFileSync(filePath, 'utf8')
      } catch (err) {
        console.warn('[obfuscate] 跳过（文件不存在）:', filePath)
        return
      }
      console.log(`[obfuscate] 混淆中: ${filePath} (${(code.length / 1024).toFixed(0)} KB)`)
      const started = Date.now()
      const result = obfuscator.obfuscate(code, OBJ_OPTIONS)
      writeFileSync(filePath, result.getObfuscatedCode())
      console.log(`[obfuscate] 完成: ${filePath} (耗时 ${((Date.now() - started) / 1000).toFixed(1)}s)`)
    }
  }
}
