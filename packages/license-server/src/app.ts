import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { canonicalize, decodeKey, encodeKey, keyIdOfPayload, signPayload, verifyPayload } from '@markweave/license-core'
import type { ActivateResponse, KeyPayload, LicenseInfo, LicensePlan, ValidateResponse } from '@markweave/license-core'
import type { Store, LicenseRow } from './db'
import type { ServerConfig } from './config'
import type { KeyPair } from './keys'

const activateSchema = z.object({
  key: z.string().min(8),
  machine: z.object({ fingerprint: z.string().min(8), name: z.string().max(64).optional() })
})
const validateSchema = z.object({ key: z.string().min(8), activationId: z.string().min(8) })
const deactivateSchema = z.object({ activationId: z.string().min(8) })
const issueSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['pro', 'commercial', 'trial']),
  machineLimit: z.number().int().min(0).default(3),
  expiresAt: z.number().int().nonnegative().default(0),
  orderId: z.string().max(64).optional()
})

const toLicenseInfo = (r: LicenseRow): LicenseInfo => ({
  plan: r.plan as LicensePlan,
  customerEmail: r.customer_email,
  orderId: r.order_id ?? '',
  issuedAt: r.issued_at,
  expiresAt: r.expires_at,
  machineLimit: r.machine_limit,
  keyId: r.key_id
})

const parseJson = async(request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export const createApp = (store: Store, cfg: ServerConfig, keys: KeyPair): Hono => {
  const app = new Hono()

  app.get('/v1/health', (c) => c.json({ ok: true, ts: Date.now() }))

  app.post('/v1/activate', async (c) => {
    const body = await parseJson(c.req.raw)
    const parsed = activateSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'BAD_REQUEST' } satisfies ActivateResponse, 400)
    const { key, machine } = parsed.data

    const decoded = decodeKey(key)
    if (!decoded) return c.json({ ok: false, error: 'BAD_FORMAT' } satisfies ActivateResponse)
    if (!verifyPayload(keys.publicKey, decoded.payload, decoded.signature)) {
      return c.json({ ok: false, error: 'INVALID_SIGNATURE' } satisfies ActivateResponse)
    }
    const payload = JSON.parse(decoded.payload) as KeyPayload
    const license = store.getLicenseByKeyId(keyIdOfPayload(decoded.payload))
    if (!license) return c.json({ ok: false, error: 'UNKNOWN_KEY' } satisfies ActivateResponse)
    if (license.revoked_at) return c.json({ ok: false, error: 'REVOKED' } satisfies ActivateResponse)
    if (license.expires_at !== 0 && license.expires_at * 1000 < Date.now()) {
      store.logEvent(license.id, 'expired')
      return c.json({ ok: false, error: 'EXPIRED' } satisfies ActivateResponse)
    }
    const active = store.countActiveActivations(license.id)
    if (license.machine_limit > 0 && active >= license.machine_limit) {
      store.logEvent(license.id, 'device-limit', { active, limit: license.machine_limit })
      return c.json({ ok: false, error: 'DEVICE_LIMIT' } satisfies ActivateResponse, 429)
    }
    const activationId = store.upsertActivation(license.id, machine)
    return c.json({ ok: true, activationId, license: toLicenseInfo(license) } satisfies ActivateResponse)
  })

  app.post('/v1/validate', async (c) => {
    const body = await parseJson(c.req.raw)
    const parsed = validateSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'BAD_REQUEST' }, 400)
    const { key, activationId } = parsed.data

    const decoded = decodeKey(key)
    if (!decoded || !verifyPayload(keys.publicKey, decoded.payload, decoded.signature)) {
      return c.json({ ok: false, revoked: true } satisfies ValidateResponse)
    }
    const row = store.getActivation(activationId)
    if (!row) return c.json({ ok: false, revoked: true } satisfies ValidateResponse)
    if (row.revoked_at) {
      store.deactivateActivation(row.id)
      store.logEvent(row.license_id, 'deactivated-revoked')
      return c.json({ ok: false, revoked: true } satisfies ValidateResponse)
    }
    if (row.expires_at !== 0 && row.expires_at * 1000 < Date.now()) {
      return c.json({ ok: false, error: 'EXPIRED' } satisfies ValidateResponse)
    }
    store.touchActivation(row.id)
    store.logEvent(row.license_id, 'validated')
    return c.json({ ok: true, license: toLicenseInfo(row) } satisfies ValidateResponse)
  })

  app.post('/v1/deactivate', async (c) => {
    const body = await parseJson(c.req.raw)
    const parsed = deactivateSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'BAD_REQUEST' }, 400)
    const row = store.getActivation(parsed.data.activationId)
    if (row) {
      store.deactivateActivation(row.id)
      store.logEvent(row.license_id, 'deactivated')
    }
    return c.json({ ok: true })
  })

  app.use('/v1/admin/*', async (c, next) => {
    const expected = cfg.adminKey
    if (!expected || c.req.header('Authorization') !== `Bearer ${expected}`) {
      return c.json({ error: 'UNAUTHORIZED' }, 401)
    }
    await next()
  })

  app.post('/v1/admin/licenses', async (c) => {
    const body = await parseJson(c.req.raw)
    const parsed = issueSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'BAD_REQUEST' }, 400)
    const { email, plan, machineLimit, expiresAt, orderId } = parsed.data
    const iat = Math.floor(Date.now() / 1000)
    const payloadStr = canonicalize({ sub: email, plan, machines: machineLimit, iat, exp: expiresAt, oid: orderId ?? '' })
    const sig = signPayload(keys.privateKey, payloadStr)
    const key = encodeKey(payloadStr, sig)
    const keyId = keyIdOfPayload(payloadStr)
    store.insertLicense({
      id: randomUUID(),
      key_id: keyId,
      customer_email: email,
      plan,
      machine_limit: machineLimit,
      issued_at: iat,
      expires_at: expiresAt,
      order_id: orderId ?? null,
      revoked_at: null,
      created_at: Date.now(),
      updated_at: Date.now()
    })
    return c.json({ ok: true, key, keyId })
  })

  app.get('/v1/admin/licenses', (c) => c.json({ licenses: store.listLicenses() }))

  app.get('/v1/admin/licenses/:keyId', (c) => {
    const license = store.getLicenseByKeyId(c.req.param('keyId'))
    if (!license) return c.json({ error: 'NOT_FOUND' }, 404)
    return c.json({ license, activations: store.listActivations(license.id) })
  })

  app.post('/v1/admin/licenses/:keyId/revoke', (c) => {
    const license = store.getLicenseByKeyId(c.req.param('keyId'))
    if (!license) return c.json({ error: 'NOT_FOUND' }, 404)
    store.setRevoked(license.id, true)
    store.logEvent(license.id, 'revoked')
    return c.json({ ok: true })
  })

  app.post('/v1/admin/licenses/:keyId/extend', async (c) => {
    const body = await parseJson(c.req.raw)
    const parsed = z.object({ expiresAt: z.number().int().nonnegative() }).safeParse(body)
    if (!parsed.success) return c.json({ error: 'BAD_REQUEST' }, 400)
    const license = store.getLicenseByKeyId(c.req.param('keyId'))
    if (!license) return c.json({ error: 'NOT_FOUND' }, 404)
    store.setExpiry(license.id, parsed.data.expiresAt)
    store.logEvent(license.id, 'extended', { expiresAt: parsed.data.expiresAt })
    return c.json({ ok: true })
  })

  return app
}
