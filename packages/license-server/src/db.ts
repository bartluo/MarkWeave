import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  key_id TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  plan TEXT NOT NULL,
  machine_limit INTEGER NOT NULL DEFAULT 3,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  order_id TEXT,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activations (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  machine_fingerprint TEXT NOT NULL,
  machine_name TEXT,
  activated_at INTEGER NOT NULL,
  deactivated_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  UNIQUE (license_id, machine_fingerprint)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT,
  type TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL
);
`

export interface LicenseRow {
  id: string
  key_id: string
  customer_email: string
  plan: string
  machine_limit: number
  issued_at: number
  expires_at: number
  order_id: string | null
  revoked_at: number | null
  created_at: number
  updated_at: number
}

export interface ActivationRow {
  id: string
  license_id: string
  machine_fingerprint: string
  machine_name: string | null
  activated_at: number
  deactivated_at: number | null
  last_seen_at: number
}

export interface ActivationWithLicense extends ActivationRow, LicenseRow {}

export class Store {
  private db: Database.Database

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
  }

  logEvent(licenseId: string | null, type: string, detail?: unknown): void {
    this.db
      .prepare('INSERT INTO events (license_id, type, detail, created_at) VALUES (?, ?, ?, ?)')
      .run(licenseId, type, detail === undefined ? null : JSON.stringify(detail), Date.now())
  }

  insertLicense(license: LicenseRow): void {
    this.db
      .prepare(
        `INSERT INTO licenses (id, key_id, customer_email, plan, machine_limit, issued_at, expires_at, order_id, revoked_at, created_at, updated_at)
         VALUES (@id, @key_id, @customer_email, @plan, @machine_limit, @issued_at, @expires_at, @order_id, @revoked_at, @created_at, @updated_at)`
      )
      .run(license)
    this.logEvent(license.id, 'issued', { plan: license.plan })
  }

  getLicenseByKeyId(keyId: string): LicenseRow | undefined {
    return this.db.prepare('SELECT * FROM licenses WHERE key_id = ?').get(keyId) as LicenseRow | undefined
  }

  getLicenseById(id: string): LicenseRow | undefined {
    return this.db.prepare('SELECT * FROM licenses WHERE id = ?').get(id) as LicenseRow | undefined
  }

  listLicenses(): LicenseRow[] {
    return this.db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all() as LicenseRow[]
  }

  countActiveActivations(licenseId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM activations WHERE license_id = ? AND deactivated_at IS NULL')
      .get(licenseId) as { n: number }
    return row.n
  }

  getActivationByMachine(licenseId: string, fingerprint: string): ActivationRow | undefined {
    return this.db
      .prepare('SELECT * FROM activations WHERE license_id = ? AND machine_fingerprint = ?')
      .get(licenseId, fingerprint) as ActivationRow | undefined
  }

  getActivation(id: string): ActivationWithLicense | undefined {
    return this.db
      .prepare(
        `SELECT a.*, l.id AS license_row_id, l.key_id, l.customer_email, l.plan, l.machine_limit, l.issued_at, l.expires_at, l.order_id, l.revoked_at, l.created_at, l.updated_at
         FROM activations a JOIN licenses l ON l.id = a.license_id WHERE a.id = ?`
      )
      .get(id) as ActivationWithLicense | undefined
  }

  listActivations(licenseId: string): ActivationRow[] {
    return this.db.prepare('SELECT * FROM activations WHERE license_id = ?').all(licenseId) as ActivationRow[]
  }

  upsertActivation(licenseId: string, machine: { fingerprint: string; name?: string }): string {
    const existing = this.getActivationByMachine(licenseId, machine.fingerprint)
    if (existing) {
      this.db
        .prepare('UPDATE activations SET deactivated_at = NULL, last_seen_at = ? WHERE id = ?')
        .run(Date.now(), existing.id)
      return existing.id
    }
    const id = randomUUID()
    this.db
      .prepare(
        'INSERT INTO activations (id, license_id, machine_fingerprint, machine_name, activated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, licenseId, machine.fingerprint, machine.name ?? null, Date.now(), Date.now())
    this.logEvent(licenseId, 'activated', { machine: machine.fingerprint })
    return id
  }

  deactivateActivation(id: string): void {
    this.db
      .prepare('UPDATE activations SET deactivated_at = ? WHERE id = ? AND deactivated_at IS NULL')
      .run(Date.now(), id)
  }

  touchActivation(id: string): void {
    this.db.prepare('UPDATE activations SET last_seen_at = ? WHERE id = ?').run(Date.now(), id)
  }

  setRevoked(licenseId: string, revoked: boolean): void {
    this.db
      .prepare('UPDATE licenses SET revoked_at = ?, updated_at = ? WHERE id = ?')
      .run(revoked ? Date.now() : null, Date.now(), licenseId)
  }

  setExpiry(licenseId: string, expiresAt: number): void {
    this.db.prepare('UPDATE licenses SET expires_at = ?, updated_at = ? WHERE id = ?').run(expiresAt, Date.now(), licenseId)
  }
}
