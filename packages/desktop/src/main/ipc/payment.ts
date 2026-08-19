import { ipcMain } from 'electron'
import log from 'electron-log'
import type { CheckoutOutcome, OrderInfo, PaymentPlanInfo, PaymentMethod } from '@shared/types/payment'

const PAYMENT_SERVER_URL = process.env.MARKWEAVE_PAYMENT_SERVER ?? 'http://localhost:3220'

async function paymentFetch<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(PAYMENT_SERVER_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      log.warn('payment server error:', res.status, path, text.slice(0, 200))
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    log.warn('payment server unreachable:', path, err)
    return null
  }
}

export const registerPaymentHandlers = (): void => {
  ipcMain.handle('mt::payment::get-plans', async () => {
    const res = await paymentFetch<{ plans: PaymentPlanInfo[] }>('/v1/plans')
    return res?.plans ?? []
  })

  ipcMain.handle('mt::payment::checkout', async (_event, plan: PaymentPlanInfo, email: string, method: PaymentMethod, customerName?: string) => {
    const res = await paymentFetch<CheckoutOutcome>('/v1/orders', {
      email,
      plan: plan.id,
      customerName
    })
    return res ?? { ok: false, error: 'UNKNOWN' }
  })

  ipcMain.handle('mt::payment::get-order', async (_event, orderId: string) => {
    const res = await paymentFetch<OrderInfo | null>(`/v1/orders/${orderId}`)
    return res
  })
}
