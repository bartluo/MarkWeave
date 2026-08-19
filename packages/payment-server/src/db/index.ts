import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { OrderRow, RefundRow, PaymentMethod, OrderPlan } from './types.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'alipay',
  alipay_trade_no TEXT,
  alipay_user_id TEXT,
  wechat_prepay_id TEXT,
  wechat_code_url TEXT,
  creem_checkout_id TEXT,
  creem_request_id TEXT,
  license_key TEXT,
  license_issued_at INTEGER,
  refunded_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  payment_method TEXT NOT NULL,
  third_party_refund_id TEXT,
  creem_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_alipay ON orders(alipay_trade_no);
CREATE INDEX IF NOT EXISTS idx_orders_wechat ON orders(wechat_prepay_id);
CREATE INDEX IF NOT EXISTS idx_orders_creem ON orders(creem_checkout_id);
CREATE INDEX IF NOT EXISTS idx_orders_creem_req ON orders(creem_request_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
`

export class Store {
  private db: Database.Database

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
  }

  createOrder(
    order: Omit<OrderRow, 'id' | 'created_at' | 'updated_at'>
  ): OrderRow {
    const now = Date.now()
    const row: OrderRow = { ...order, id: randomUUID(), created_at: now, updated_at: now }
    this.db.prepare(
      `INSERT INTO orders (id, customer_email, customer_name, plan, amount_cents, currency,
       status, payment_method, alipay_trade_no, alipay_user_id, wechat_prepay_id, wechat_code_url,
       license_key, license_issued_at, refunded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id, row.customer_email, row.customer_name ?? null, row.plan, row.amount_cents,
      row.currency, row.status, row.payment_method,
      row.alipay_trade_no ?? null, row.alipay_user_id ?? null,
      row.wechat_prepay_id ?? null, row.wechat_code_url ?? null,
      row.creem_checkout_id ?? null, row.creem_request_id ?? null,
      row.license_key ?? null, row.license_issued_at ?? null,
      row.refunded_at ?? null, row.created_at, row.updated_at
    )
    return row
  }

  getOrderById(id: string): OrderRow | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined
  }

  getOrderAlipay(tno: string): OrderRow | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE alipay_trade_no = ?').get(tno) as OrderRow | undefined
  }

  getOrderWechat(prepayId: string): OrderRow | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE wechat_prepay_id = ?').get(prepayId) as OrderRow | undefined
  }

  getOrderCreem(checkoutId: string): OrderRow | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE creem_checkout_id = ?').get(checkoutId) as OrderRow | undefined
  }

  getOrderCreemRequestId(requestId: string): OrderRow | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE creem_request_id = ?').get(requestId) as OrderRow | undefined
  }

  listOrders(status?: string, limit = 50): OrderRow[] {
    let sql = 'SELECT * FROM orders ORDER BY created_at DESC'
    const params: unknown[] = []
    if (status) { sql = 'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC'; params.push(status) }
    sql += ` LIMIT ${limit}`
    return this.db.prepare(sql).all(...params) as OrderRow[]
  }

  updateOrder(id: string, updates: Partial<OrderRow>): void {
    const sets: string[] = []
    const vals: unknown[] = []
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v) }
    }
    sets.push('updated_at = ?'); vals.push(Date.now())
    vals.push(id)
    this.db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  }

  createRefund(refund: Omit<RefundRow, 'id' | 'created_at'>): RefundRow {
    const row: RefundRow = { ...refund, id: randomUUID(), created_at: Date.now() }
    this.db.prepare(
      'INSERT INTO refunds (id, order_id, amount_cents, reason, payment_method, third_party_refund_id, creem_refund_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      row.id, row.order_id, row.amount_cents, row.reason ?? null,
      row.payment_method, row.third_party_refund_id ?? null, row.creem_refund_id ?? null,
      row.status, row.created_at
    )
    return row
  }
}
