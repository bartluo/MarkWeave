import crypto from 'node:crypto'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

const APP_PORT = Number(process.env.AUTH_SERVER_PORT ?? 3230)
const JWT_SECRET = process.env.JWT_SECRET ?? 'markweave-dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'
const REFRESH_JWT_EXPIRES_IN = '30d'

// ── Auth context stored per-request via Hono context variables ──────────────
type AuthCtx = { userId: string; email: string }
declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthCtx
  }
}

const app = new Hono<{ Variables: { auth?: AuthCtx } }>()

// ── Schema ────────────────────────────────────────────────────────────────────

function getDb() {
  const dbPath = process.env.AUTH_DB_PATH ?? './data/auth.db'
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      display_name TEXT,
      avatar_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      license_key_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      activated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      order_id TEXT,
      linked_at INTEGER NOT NULL,
      UNIQUE(user_id, license_key_id)
    );
    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      device_fingerprint TEXT NOT NULL,
      device_name TEXT,
      last_active_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, device_fingerprint)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_plans_user ON user_plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_devices_user ON user_devices(user_id);

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id TEXT NOT NULL REFERENCES users(id),
      max_members INTEGER NOT NULL DEFAULT 5,
      plan_type TEXT NOT NULL DEFAULT 'commercial',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER NOT NULL,
      UNIQUE(team_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS team_invitations (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      code TEXT NOT NULL UNIQUE,
      invited_email TEXT NOT NULL,
      inviter_user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      min_purchase_cents INTEGER,
      max_discount_cents INTEGER,
      max_redemptions INTEGER,
      max_redemptions_per_user INTEGER,
      applicable_plans TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      valid_from INTEGER NOT NULL,
      valid_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id TEXT PRIMARY KEY,
      coupon_id TEXT NOT NULL REFERENCES coupons(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      order_id TEXT,
      discount_cents INTEGER NOT NULL,
      redeemed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      device_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      occurred_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at INTEGER,
      action_url TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_user_id TEXT NOT NULL REFERENCES users(id),
      referred_user_id TEXT REFERENCES users(id),
      referral_code TEXT NOT NULL UNIQUE,
      referred_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      converted_at INTEGER,
      reward_cents INTEGER,
      created_at INTEGER NOT NULL
    );
  `)
  return db
}

function generateId(): string {
  return crypto.randomUUID()
}

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_JWT_EXPIRES_IN })
}

function verifyToken(token: string): { sub: string; email: string; type?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; type?: string }
  } catch {
    return null
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

const authMiddleware = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
  const payload = verifyToken(authHeader.slice(7))
  if (!payload) return c.json({ error: 'INVALID_TOKEN' }, 401)
  c.set('auth', { userId: payload.sub, email: payload.email })
  await next()
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /v1/auth/register
app.post('/v1/auth/register', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().min(1).max(64)
  }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.data.email) as any
  if (existing) return c.json({ error: 'EMAIL_EXISTS' }, 409)

  const id = generateId()
  const now = Math.floor(Date.now() / 1000)
  const passwordHash = await hashPassword(parsed.data.password)
  db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, parsed.data.email, passwordHash, parsed.data.displayName, now, now)

  const accessToken = signAccessToken(id, parsed.data.email)
  const refreshToken = signRefreshToken(id)
  db.prepare(
    'INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(generateId(), id, accessToken, refreshToken, now + 7 * 24 * 60 * 60, now)
  db.close()

  return c.json({
    ok: true,
    token: accessToken,
    refreshToken,
    expiresIn: 7 * 24 * 60 * 60,
    user: { id, email: parsed.data.email, displayName: parsed.data.displayName, createdAt: now }
  })
})

// POST /v1/auth/login
app.post('/v1/auth/login', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email) as any
  if (!user) return c.json({ error: 'USER_NOT_FOUND' }, 404)
  if (!user.password_hash) return c.json({ error: 'OAUTH_ONLY' }, 400)

  const valid = await verifyPassword(parsed.data.password, user.password_hash)
  if (!valid) return c.json({ error: 'INVALID_PASSWORD' }, 401)

  const now = Math.floor(Date.now() / 1000)
  const accessToken = signAccessToken(user.id, user.email)
  const refreshToken = signRefreshToken(user.id)
  db.prepare(
    'INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(generateId(), user.id, accessToken, refreshToken, now + 7 * 24 * 60 * 60, now)
  db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(now, user.id)
  db.close()

  return c.json({
    ok: true,
    token: accessToken,
    refreshToken,
    expiresIn: 7 * 24 * 60 * 60,
    user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at }
  })
})

// POST /v1/auth/refresh
app.post('/v1/auth/refresh', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({ refreshToken: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const payload = verifyToken(parsed.data.refreshToken)
  if (!payload || payload.type !== 'refresh') return c.json({ error: 'INVALID_REFRESH_TOKEN' }, 401)

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as any
  if (!user) return c.json({ error: 'USER_NOT_FOUND' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const accessToken = signAccessToken(user.id, user.email)
  const newRefreshToken = signRefreshToken(user.id)
  db.prepare(
    'INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(generateId(), user.id, accessToken, newRefreshToken, now + 7 * 24 * 60 * 60, now)
  db.close()

  return c.json({ ok: true, token: accessToken, refreshToken: newRefreshToken, expiresIn: 7 * 24 * 60 * 60 })
})

// POST /v1/auth/logout
app.post('/v1/auth/logout', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  db.close()
  return c.json({ ok: true })
})

// GET /v1/profile
app.get('/v1/profile', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any
  if (!user) return c.json({ error: 'NOT_FOUND' }, 404)

  const plans = db.prepare('SELECT * FROM user_plans WHERE user_id = ?').all(userId) as any[]
  const devices = db.prepare(
    'SELECT * FROM user_devices WHERE user_id = ? ORDER BY last_active_at DESC'
  ).all(userId) as any[]
  db.close()

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    plans: plans.map((p: any) => ({
      planId: p.license_key_id,
      planType: p.plan,
      status: p.status,
      activatedAt: p.activated_at,
      expiresAt: p.expires_at,
      orderId: p.order_id
    })),
    devices: devices.map((d: any) => ({
      deviceId: d.id,
      name: d.device_name,
      fingerprint: d.device_fingerprint,
      lastActiveAt: d.last_active_at,
      isActive: true
    }))
  })
})

// GET /v1/devices
app.get('/v1/devices', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  const devices = db.prepare(
    'SELECT * FROM user_devices WHERE user_id = ? ORDER BY last_active_at DESC'
  ).all(userId) as any[]
  db.close()
  return c.json({
    current: devices[0] ?? null,
    devices: devices.map((d: any) => ({
      deviceId: d.id,
      name: d.device_name,
      fingerprint: d.device_fingerprint,
      lastActiveAt: d.last_active_at,
      isActive: true
    })),
    limit: 5
  })
})

// POST /v1/devices
app.post('/v1/devices', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const body = await c.req.json()
  const parsed = z.object({ name: z.string().max(64), fingerprint: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const id = generateId()
  db.prepare(
    'INSERT OR REPLACE INTO user_devices (id, user_id, device_fingerprint, device_name, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, parsed.data.fingerprint, parsed.data.name, now, now)
  db.close()
  return c.json({ ok: true, deviceId: id })
})

// DELETE /v1/devices/:deviceId
app.delete('/v1/devices/:deviceId', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const deviceId = c.req.param('deviceId')
  const db = getDb()
  db.prepare('DELETE FROM user_devices WHERE id = ? AND user_id = ?').run(deviceId, userId)
  db.close()
  return c.json({ ok: true })
})

// POST /v1/licenses/link
app.post('/v1/licenses/link', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const body = await c.req.json()
  const parsed = z.object({ licenseKey: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const keyParts = parsed.data.licenseKey.split('.')
  if (keyParts.length < 3) return c.json({ error: 'INVALID_LICENSE_KEY' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const id = generateId()
  db.prepare(
    'INSERT INTO user_plans (id, user_id, license_key_id, plan, status, activated_at, expires_at, linked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, keyParts[1], 'pro', 'active', now, 0, now)
  db.close()
  return c.json({ ok: true })
})

// GET /v1/oauth/:provider
app.get('/v1/oauth/:provider', (c) => {
  const provider = c.req.param('provider')
  const { redirect_uri } = c.req.query()
  if (!redirect_uri) return c.json({ error: 'MISSING_REDIRECT_URI' }, 400)
  if (provider === 'google') {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri, response_type: 'code', scope: 'openid email profile',
      access_type: 'offline', prompt: 'consent'
    }).toString()}`
    return c.json({ authUrl: url })
  }
  if (provider === 'github') {
    const url = `https://github.com/login/oauth/authorize?${new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID ?? '',
      redirect_uri, scope: 'read:user user:email'
    }).toString()}`
    return c.json({ authUrl: url })
  }
  return c.json({ error: 'UNKNOWN_PROVIDER' }, 400)
})

// POST /v1/oauth/callback
app.post('/v1/oauth/callback', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({
    code: z.string(),
    state: z.string(),
    provider: z.enum(['google', 'github'])
  }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const email = `${parsed.data.provider}-user@oauth.local`
  const userId = generateId()

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any
  if (existing) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id) as any
    const accessToken = signAccessToken(user.id, user.email)
    const refreshToken = signRefreshToken(user.id)
    db.prepare(
      'INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(generateId(), user.id, accessToken, refreshToken, now + 7 * 24 * 60 * 60, now)
    db.close()
    return c.json({ ok: true, token: accessToken, refreshToken, expiresIn: 7 * 24 * 60 * 60 })
  }

  const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'))
  db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, email, passwordHash, `${parsed.data.provider} User`, now, now)

  const accessToken = signAccessToken(userId, email)
  const refreshToken = signRefreshToken(userId)
  db.prepare(
    'INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(generateId(), userId, accessToken, refreshToken, now + 7 * 24 * 60 * 60, now)
  db.close()
  return c.json({ ok: true, token: accessToken, refreshToken, expiresIn: 7 * 24 * 60 * 60 })
})

// ── 商业端点 ──────────────────────────────────────────────────────────────────

// POST /v1/subscriptions — create or manage subscription
app.post('/v1/subscriptions', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const body = await c.req.json()
  const parsed = z.object({
    planId: z.string(),
    billingCycle: z.enum(['monthly', 'annual', 'lifetime']),
    couponCode: z.string().optional(),
    paymentMethod: z.string().optional()
  }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const id = generateId()
  const plan = db.prepare('SELECT * FROM user_plans WHERE license_key_id = ?').get(parsed.data.planId) as any
  const planType = plan?.plan ?? parsed.data.planId

  db.prepare(
    `INSERT INTO user_plans (id, user_id, license_key_id, plan, status, activated_at, expires_at, linked_at, order_id)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(id, userId, parsed.data.planId, planType, now, now + 365 * 24 * 60 * 60, parsed.data.couponCode ?? null, null)
  db.close()

  return c.json({ ok: true, subscriptionId: id, planType, billingCycle: parsed.data.billingCycle })
})

// GET /v1/subscriptions/me
app.get('/v1/subscriptions/me', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  const subscription = db.prepare(
    `SELECT * FROM user_plans WHERE user_id = ? ORDER BY linked_at DESC LIMIT 1`
  ).get(userId) as any
  db.close()
  if (!subscription) return c.json(null)
  return c.json({
    id: subscription.id,
    planId: subscription.license_key_id,
    planType: subscription.plan,
    status: subscription.status,
    activatedAt: subscription.activated_at,
    expiresAt: subscription.expires_at,
    orderId: subscription.order_id
  })
})

// POST /v1/coupons/validate — check if coupon is valid
app.post('/v1/coupons/validate', authMiddleware, async (c) => {
  const body = await c.req.json()
  const parsed = z.object({ code: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(parsed.data.code) as any
  db.close()
  if (!coupon) return c.json({ valid: false, error: 'COUPON_NOT_FOUND' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const valid = coupon.status === 'active' && now >= coupon.valid_from && now <= coupon.valid_until
  return c.json({ valid, coupon: valid ? { type: coupon.type, value: coupon.value, name: coupon.name } : null })
})

// POST /v1/teams — create team
app.post('/v1/teams', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const body = await c.req.json()
  const parsed = z.object({ name: z.string().min(1).max(128), description: z.string().max(500).optional() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const id = generateId()
  db.prepare(
    'INSERT INTO teams (id, name, description, owner_id, max_members, plan_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, 5, \'commercial\', \'active\', ?, ?)'
  ).run(id, parsed.data.name, parsed.data.description ?? null, userId, now, now)
  db.prepare(
    'INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, ?, ?, \'owner\', ?)'
  ).run(generateId(), id, userId, now)
  db.close()
  return c.json({ ok: true, teamId: id, name: parsed.data.name })
})

// GET /v1/teams/:teamId
app.get('/v1/teams/:teamId', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const teamId = c.req.param('teamId')
  const db = getDb()
  const member = db.prepare(
    'SELECT * FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(teamId, userId) as any
  if (!member) return c.json({ error: 'NOT_TEAM_MEMBER' }, 403)

  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any
  const members = db.prepare(
    'SELECT * FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = ?'
  ).all(teamId) as any[]
  db.close()
  return c.json({
    id: team.id, name: team.name, description: team.description,
    planType: team.plan_type, maxMembers: team.max_members,
    members: members.map((m: any) => ({
      userId: m.user_id, email: m.email, displayName: m.display_name, role: m.role
    }))
  })
})

// POST /v1/teams/:teamId/invite
app.post('/v1/teams/:teamId/invite', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const teamId = c.req.param('teamId')
  const body = await c.req.json()
  const parsed = z.object({ email: z.string().email(), role: z.enum(['admin', 'member']).optional() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const member = db.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, userId) as any
  if (!member || member.role !== 'owner') return c.json({ error: 'PERMISSION_DENIED' }, 403)

  const now = Math.floor(Date.now() / 1000)
  const code = crypto.randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO team_invitations (id, team_id, code, invited_email, inviter_user_id, role, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, \'pending\', ?, ?)'
  ).run(generateId(), teamId, code, parsed.data.email, userId, parsed.data.role ?? 'member', now + 7 * 24 * 60 * 60, now)
  db.close()
  return c.json({ ok: true, inviteCode: code })
})

// POST /v1/teams/accept-invite — accept team invitation
app.post('/v1/teams/accept-invite', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const body = await c.req.json()
  const parsed = z.object({ code: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const invite = db.prepare(
    'SELECT * FROM team_invitations WHERE code = ? AND status = \'pending\''
  ).get(parsed.data.code) as any
  if (!invite) return c.json({ error: 'INVALID_OR_EXPIRED_INVITE' }, 404)

  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
  ).run(generateId(), invite.team_id, userId, invite.role, now)
  db.prepare('UPDATE team_invitations SET status = \'accepted\' WHERE id = ?').run(invite.id)
  db.close()
  return c.json({ ok: true, teamId: invite.team_id, role: invite.role })
})

// POST /v1/analytics/event — log analytics event
app.post('/v1/analytics/event', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const body = await c.req.json()
  const parsed = z.object({
    eventType: z.string(),
    eventData: z.record(z.unknown()).optional()
  }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO analytics_events (id, user_id, event_type, event_data, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(generateId(), userId, parsed.data.eventType, JSON.stringify(parsed.data.eventData ?? {}), now, now)
  db.close()
  return c.json({ ok: true })
})

// GET /v1/notifications/unread-count
app.get('/v1/notifications/unread-count', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId) as { cnt: number }
  db.close()
  return c.json({ count: count.cnt })
})

// GET /v1/notifications
app.get('/v1/notifications', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(userId) as any[]
  db.close()
  return c.json(notifications.map((n: any) => ({
    id: n.id, type: n.type, title: n.title, message: n.message,
    readAt: n.read_at, actionUrl: n.action_url, createdAt: n.created_at
  })))
})

// POST /v1/notifications/:id/read
app.post('/v1/notifications/:id/read', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const notifId = c.req.param('id')
  const db = getDb()
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(
    Math.floor(Date.now() / 1000), notifId, userId
  )
  db.close()
  return c.json({ ok: true })
})

// POST /v1/referrals — generate referral code for user
app.post('/v1/referrals', authMiddleware, async (c) => {
  const { userId } = c.get('auth')!
  const db = getDb()
  // Check if code already exists
  const existing = db.prepare('SELECT id FROM referrals WHERE referrer_user_id = ?').get(userId) as any
  if (existing) return c.json({ ok: true, referralCode: existing.referral_code })

  const code = `MW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO referrals (id, referrer_user_id, referral_code, status, created_at) VALUES (?, ?, ?, \'pending\', ?)'
  ).run(generateId(), userId, code, now)
  db.close()
  return c.json({ ok: true, referralCode: code })
})

// POST /v1/referrals/convert — convert referral code
app.post('/v1/referrals/convert', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({ code: z.string(), referredEmail: z.string().email() }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const referral = db.prepare('SELECT * FROM referrals WHERE referral_code = ? AND status = \'pending\'').get(parsed.data.code) as any
  if (!referral) return c.json({ error: 'INVALID_CODE' }, 404)

  // Find or create the referred user
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.data.referredEmail) as any
  const referredUserId = existingUser?.id ?? generateId()
  if (!existingUser) {
    const now = Math.floor(Date.now() / 1000)
    db.prepare(
      'INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(referredUserId, parsed.data.referredEmail, 'Referred User', now, now)
  }

  const now = Math.floor(Date.now() / 1000)
  db.prepare('UPDATE referrals SET status = \'converted\', referred_user_id = ?, converted_at = ? WHERE id = ?')
    .run(referredUserId, now, referral.id)
  db.close()
  return c.json({ ok: true, referrerUserId: referral.referrer_user_id, referredUserId })
})

// ── 管理员接口（供支付服务调用） ────────────────────────────────────────────────

const ADMIN_KEY = process.env.AUTH_ADMIN_KEY ?? ''

app.use('/v1/admin/*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!ADMIN_KEY || !authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
  if (authHeader.slice(7) !== ADMIN_KEY) {
    return c.json({ error: 'INVALID_KEY' }, 401)
  }
  await next()
})

// POST /v1/admin/plans — 支付完成后激活用户计划
app.post('/v1/admin/plans', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({
    email: z.string().email(),
    plan: z.enum(['pro', 'commercial', 'trial']),
    licenseKeyId: z.string(),
    orderId: z.string().optional(),
    expiresAt: z.number().optional()
  }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT' }, 400)

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const expiresInDays = parsed.data.plan === 'trial' ? 14 : 365
  const expiresAt = parsed.data.expiresAt ?? (now + (parsed.data.expiresAt ? 0 : expiresInDays * 86400))

  let user = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.data.email) as any
  if (!user) {
    const userId = generateId()
    db.prepare(
      'INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, parsed.data.email, parsed.data.email, now, now)
    user = { id: userId }
  }

  const planId = generateId()
  db.prepare(
    `INSERT INTO user_plans (id, user_id, license_key_id, plan, status, activated_at, expires_at, order_id, linked_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(planId, user.id, parsed.data.licenseKeyId, parsed.data.plan, now, expiresAt, parsed.data.orderId ?? null, now)
  db.close()
  return c.json({ ok: true, userId: user.id, planId })
})

// ── Start ─────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port: APP_PORT })
  console.log(`Auth server listening on http://localhost:${APP_PORT}`)
}

export default app
