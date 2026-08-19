import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CheckoutOutcome, PaymentPlanInfo, OrderInfo } from '@shared/types/payment'
import type { PaymentMethod } from '@shared/types/payment'

export const usePaymentStore = defineStore('payment', () => {
  const plans = ref<PaymentPlanInfo[]>([])
  const currentOrder = ref<OrderInfo | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  const plansLoaded = computed(() => plans.value.length > 0)
  const hasActiveOrder = computed(() =>
    currentOrder.value !== null &&
    ['pending', 'awaiting_payment'].includes(currentOrder.value.status)
  )

  async function init(): Promise<PaymentPlanInfo[]> {
    loading.value = true
    error.value = null
    try {
      plans.value = await window.payment.getPlans()
      return plans.value
    } catch (e) {
      console.error('Failed to load payment plans:', e)
      error.value = 'PLAN_LOAD_FAILED'
      return []
    } finally {
      loading.value = false
    }
  }

  async function checkout(
    plan: PaymentPlanInfo,
    email: string,
    method: PaymentMethod = 'alipay',
    customerName?: string
  ): Promise<CheckoutOutcome> {
    loading.value = true
    error.value = null
    try {
      const result = await window.payment.checkout(plan, email, method, customerName)
      if (result.ok) {
        currentOrder.value = {
          id: result.orderId,
          status: result.licenseKey ? 'licensed' : 'awaiting_payment',
          plan: plan.id,
          amountCents: plan.priceCents,
          currency: plan.currency,
          email,
          licenseKey: result.licenseKey,
          paymentMethod: method,
          createdAt: Date.now()
        }
        // 支付宝/Creem：打开支付页面
        if (result.payUrl) {
          await window.electron?.shell?.openExternal?.(result.payUrl)
        }
        return result
      }
      error.value = result.error
      return result
    } catch (e) {
      console.error('Checkout failed:', e)
      error.value = 'CHECKOUT_ERROR'
      return { ok: false, error: 'CHECKOUT_ERROR' }
    } finally {
      loading.value = false
    }
  }

  // 取消正在进行的轮询
  let _pollCancelled = false
  let _pollTimer: ReturnType<typeof setTimeout> | null = null
  let _pollInterval: ReturnType<typeof setInterval> | null = null

  function cancelPoll(): void {
    _pollCancelled = true
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null }
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null }
  }

  async function pollOrder(orderId: string, onOrder?: (order: OrderInfo) => void): Promise<void> {
    _pollCancelled = false
    _pollTimer = null
    _pollInterval = null
    // 根据支付方式动态设置最大轮询次数：支付宝 15 分钟，微信 2 分钟
    const maxPolls = currentOrder.value?.paymentMethod === 'wechat' ? 60 : 450
    const pollOnce = (): Promise<void> => new Promise<void>((resolve) => {
      _pollTimer = setTimeout(resolve, 2000)
    })
    let polls = 0
    while (polls < maxPolls && !_pollCancelled) {
      await pollOnce()
      if (_pollCancelled) { return }
      const order = await window.payment.getOrder(orderId)
      if (order) {
        currentOrder.value = order
        onOrder?.(order)
        if (order.status === 'licensed' || order.status === 'refunded' || order.status === 'cancelled' || order.status === 'license_failed') {
          return
        }
      }
      polls++
    }
  }

  async function refreshOrder(orderId: string): Promise<OrderInfo | null> {
    const order = await window.payment.getOrder(orderId)
    currentOrder.value = order
    return order
  }

  return {
    plans,
    currentOrder,
    error,
    loading,
    plansLoaded,
    hasActiveOrder,
    init,
    checkout,
    pollOrder,
    cancelPoll,
    refreshOrder
  }
})
