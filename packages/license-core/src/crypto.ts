import { createHash, sign, verify, type KeyObject } from 'node:crypto'

export const KEY_PREFIX = 'MWK.'

export const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`
}

export const encodeKey = (payload: string, signature: Buffer): string =>
  `${KEY_PREFIX}${Buffer.from(payload, 'utf8').toString('base64url')}.${signature.toString('base64url')}`

export const decodeKey = (raw: string): { payload: string; signature: Buffer } | null => {
  const key = raw.replace(/[\s-]/g, '')
  if (!key.startsWith(KEY_PREFIX)) return null
  const dot = key.indexOf('.', KEY_PREFIX.length)
  if (dot === -1) return null
  try {
    return {
      payload: Buffer.from(key.slice(KEY_PREFIX.length, dot), 'base64url').toString('utf8'),
      signature: Buffer.from(key.slice(dot + 1), 'base64url')
    }
  } catch {
    return null
  }
}

export const signPayload = (privateKey: KeyObject, payload: string): Buffer =>
  sign(null, Buffer.from(payload, 'utf8'), privateKey)

export const verifyPayload = (publicKey: KeyObject, payload: string, signature: Buffer): boolean => {
  try {
    return verify(null, Buffer.from(payload, 'utf8'), publicKey, signature)
  } catch {
    return false
  }
}

export const keyIdOfPayload = (payload: string): string =>
  createHash('sha256').update(Buffer.from(payload, 'utf8').toString('base64url')).digest('hex').slice(0, 16)
