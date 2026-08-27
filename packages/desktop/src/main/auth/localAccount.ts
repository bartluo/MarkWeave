import crypto from 'node:crypto'
import Store from 'electron-store'
import log from 'electron-log'

interface LocalAccountRecord {
  email: string
  displayName: string
  salt: string
  passwordHash: string
  createdAt: number
}

type LocalAccountResult = { ok: true; email?: string; displayName?: string } | { ok: false; error: string }

// First-run gate: the app requires a local account before the editor is
// usable. Credentials stay on this machine (scrypt-hashed), independent from
// the optional cloud account flow.
class LocalAccountStore {
  private store: Store<Record<string, unknown>>

  constructor() {
    this.store = new Store<Record<string, unknown>>({ name: 'local-account' })
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex')
  }

  getRecord(): LocalAccountRecord | null {
    const raw = this.store.get('account') as LocalAccountRecord | undefined
    return raw && typeof raw.email === 'string' ? raw : null
  }

  isLoggedIn(): boolean {
    return !!this.store.get('loggedIn')
  }

  register(email: string, password: string, displayName: string): LocalAccountResult {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, error: 'INVALID_EMAIL' }
    }
    if (typeof password !== 'string' || password.length < 8) {
      return { ok: false, error: 'WEAK_PASSWORD' }
    }
    if (this.getRecord()) {
      return { ok: false, error: 'ALREADY_REGISTERED' }
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const record: LocalAccountRecord = {
      email: normalizedEmail,
      displayName: displayName.trim().slice(0, 64) || normalizedEmail.split('@')[0],
      salt,
      passwordHash: this.hashPassword(password, salt),
      createdAt: Date.now()
    }
    try {
      this.store.set('account', record)
      this.store.set('loggedIn', true)
      return { ok: true, email: record.email, displayName: record.displayName }
    } catch (err) {
      log.error('local account register failed:', err)
      return { ok: false, error: 'STORAGE_ERROR' }
    }
  }

  login(email: string, password: string): LocalAccountResult {
    const record = this.getRecord()
    if (!record) return { ok: false, error: 'NOT_REGISTERED' }
    if (record.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return { ok: false, error: 'INVALID_CREDENTIALS' }
    }
    const hash = Buffer.from(this.hashPassword(String(password), record.salt), 'hex')
    const expected = Buffer.from(record.passwordHash, 'hex')
    if (hash.length !== expected.length || !crypto.timingSafeEqual(hash, expected)) {
      return { ok: false, error: 'INVALID_CREDENTIALS' }
    }
    this.store.set('loggedIn', true)
    return { ok: true, email: record.email, displayName: record.displayName }
  }

  logout(): void {
    this.store.set('loggedIn', false)
  }

  status(): { registered: boolean; loggedIn: boolean; email?: string; displayName?: string } {
    const record = this.getRecord()
    return {
      registered: !!record,
      loggedIn: this.isLoggedIn(),
      email: record?.email,
      displayName: record?.displayName
    }
  }
}

export { LocalAccountStore }
