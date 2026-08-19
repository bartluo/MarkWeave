<template>
  <div class="activation-dialog">
    <el-dialog
      v-model="showDialog"
      :show-close="true"
      width="520px"
    >
      <template #header>
        <span class="title">{{ t('license.dialog.title') }}</span>
      </template>

      <!-- 已激活 -->
      <template v-if="licenseStore.isPro">
        <el-result
          icon="success"
          :title="t('license.activated')"
          :sub-title="subTitle"
        />
        <div class="meta">
          <p><span class="label">{{ t('license.plan') }}:</span> {{ planLabel }}</p>
          <p v-if="email"><span class="label">{{ t('license.email') }}:</span> {{ email }}</p>
          <p v-if="activatedAt"><span class="label">{{ t('license.activatedAt') }}:</span> {{ activatedAt }}</p>
          <p v-if="expiresAt"><span class="label">{{ t('license.expiresAt') }}:</span> {{ expiresAt }}</p>
          <p v-if="authStore.isAuthenticated"><span class="label">{{ t('license.account') }}:</span> {{ authStore.email }}</p>
        </div>
        <div v-if="authStore.isAuthenticated" class="account-actions">
          <el-button size="small" @click="handleLinkLicense">
            {{ t('license.linkLicense') }}
          </el-button>
          <el-button size="small" @click="handleOAuth('google')">
            {{ t('license.signInGoogle') }}
          </el-button>
        </div>
      </template>

      <!-- 未激活：等待支付（显示二维码） -->
      <template v-else-if="pendingOrderId && pendingQrUrl">
        <div class="pay-qr-section">
          <p class="pay-qr-title">{{ qrTitle }}</p>
          <div class="qr-container">
            <img
              :src="pendingQrUrl"
              :alt="t('license.qrCode')"
              class="qr-image"
            />
          </div>
          <div class="qr-footer">
            <span class="countdown">{{ countdownText }}</span>
            <el-button size="small" @click="handlePollNow">
              {{ t('license.refreshStatus') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 未激活：选择套餐 -->
      <template v-else>
        <div class="upgrade-section">
          <p class="upgrade-hint">{{ t('license.dialog.desc') }}</p>

          <!-- 套餐卡片 -->
          <div class="plan-cards">
            <div
              v-for="p in plans"
              :key="p.id"
              class="plan-card"
              :class="{ selected: selectedPlan?.id === p.id }"
              @click="selectedPlan = p"
            >
              <div class="plan-name">{{ p.displayName }}</div>
              <div class="plan-price">{{ formatPrice(p.priceCents, p.currency) }}</div>
              <div class="plan-desc">{{ p.description }}</div>
            </div>
          </div>

          <!-- 支付方式选择 -->
          <div class="pay-method-row">
            <span class="pay-method-label">{{ t('license.payMethod') }}:</span>
            <div class="pay-method-buttons">
              <el-button
                :type="selectedMethod === 'alipay' ? 'primary' : 'default'"
                size="small"
                @click="selectedMethod = 'alipay'"
              >
                <span class="method-icon alipay-icon">支</span>
                {{ t('license.methodAlipay') }}
              </el-button>
              <el-button
                :type="selectedMethod === 'wechat' ? 'primary' : 'default'"
                size="small"
                @click="selectedMethod = 'wechat'"
              >
                <span class="method-icon wechat-icon">微</span>
                {{ t('license.methodWechat') }}
              </el-button>
              <el-button
                :type="selectedMethod === 'creem' ? 'primary' : 'default'"
                size="small"
                @click="selectedMethod = 'creem'"
              >
                <span class="method-icon creem-icon">C</span>
                {{ t('license.methodCreem') }}
              </el-button>
            </div>
          </div>

          <!-- 邮箱输入 -->
          <el-input
            v-model="paymentEmail"
            :placeholder="t('license.emailHint')"
            class="email-input"
          />

          <!-- 支付按钮 -->
          <el-button
            type="primary"
            :loading="payLoading"
            :disabled="!selectedPlan || !paymentEmail.trim()"
            @click="handlePay"
          >
            {{ payLoading ? t('license.processing') : t('license.payNow') }}
          </el-button>

          <el-divider />

          <!-- 手动输入许可证密钥 -->
          <p class="manual-hint">{{ t('license.manualHint') }}</p>
          <el-input
            v-model="key"
            :placeholder="t('license.dialog.placeholder')"
            autocomplete="off"
            spellcheck="false"
            class="key-input"
          />
          <el-alert
            v-if="licenseStore.error"
            class="err"
            type="error"
            :closable="false"
            :title="errorText"
          />
          <div class="btn-row">
            <el-button
              :loading="licenseStore.loading"
              type="primary"
              @click="handleActivate"
            >
              {{ t('license.dialog.activate') }}
            </el-button>
            <el-button @click="handleOpenWeb">
              {{ t('license.openWebsite') }}
            </el-button>
          </div>
        </div>
      </template>

      <template #footer>
        <el-button @click="close">
          {{ t('license.dialog.close') }}
        </el-button>
        <el-button
          v-if="licenseStore.isPro"
          type="danger"
          plain
          @click="handleDeactivate"
        >
          {{ t('license.dialog.deactivate') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useLicenseStore } from '@/store/license'
import { usePaymentStore } from '@/store/payment'
import { useAuthStore } from '@/store/auth'
import bus from '../../bus'
import type { PaymentPlanInfo } from '@shared/types/payment'
import type { PaymentMethod } from '@shared/types/payment'

const { t } = useI18n()
const licenseStore = useLicenseStore()
const paymentStore = usePaymentStore()
const authStore = useAuthStore()

const showDialog = ref(false)
const key = ref('')
const paymentEmail = ref('')
const selectedPlan = ref<PaymentPlanInfo | null>(null)
const selectedMethod = ref<PaymentMethod>('alipay')
const payLoading = ref(false)
const pendingOrderId = ref<string | null>(null)
const pendingQrUrl = ref<string>('')

// Auth form state
const showAuthPanel = ref(false)
const authMode = ref<'login' | 'register'>('login')
const authEmail = ref('')
const authPassword = ref('')
const authDisplayName = ref('')
const authLoading = ref(false)
const authError = ref('')

// 倒计时
const countdownEnd = ref<number>(0)
const countdownInterval = ref<ReturnType<typeof setInterval> | null>(null)

const plans = ref<PaymentPlanInfo[]>([])
const error = computed(() => licenseStore.error)

const email = computed(() => licenseStore.state?.license?.customerEmail ?? '')
const activatedAt = computed(() => {
  const ts = licenseStore.state?.license?.issuedAt
  return ts ? new Date(ts * 1000).toLocaleString() : ''
})
const expiresAt = computed(() => {
  const ts = licenseStore.state?.license?.expiresAt
  return ts && ts > 0 ? new Date(ts * 1000).toLocaleString() : ''
})
const subTitle = computed(() => `${t('license.plan')}: ${planLabel.value}`)
const planLabel = computed(() => {
  switch (licenseStore.plan) {
    case 'pro': return t('license.planPro')
    case 'commercial': return t('license.planCommercial')
    case 'trial': return t('license.planTrial')
    default: return t('license.planFree')
  }
})

const countdownText = computed(() => {
  if (!countdownEnd.value) return ''
  const remaining = Math.max(0, Math.ceil((countdownEnd.value - Date.now()) / 1000))
  if (remaining <= 0) return t('license.qrExpired')
  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
})

const qrTitle = computed(() => {
  if (selectedMethod.value === 'alipay') return t('license.alipayQrHint')
  if (selectedMethod.value === 'wechat') return t('license.wechatQrHint')
  return t('license.awaitingPayment')
})

const ERROR_KEY_MAP: Record<string, string> = {
  BAD_FORMAT: 'license.error.badFormat',
  INVALID_SIGNATURE: 'license.error.invalidSignature',
  BAD_PAYLOAD: 'license.error.badPayload',
  EXPIRED: 'license.error.expired',
  REVOKED: 'license.error.revoked',
  DEVICE_LIMIT: 'license.error.deviceLimit',
  NETWORK: 'license.error.network',
  SERVER: 'license.error.server',
  UNKNOWN_KEY: 'license.error.unknownKey'
}

const errorText = computed(() => {
  if (!licenseStore.error) return ''
  const msgKey = ERROR_KEY_MAP[licenseStore.error]
  return msgKey ? t(msgKey) : `${t('license.error.unknown')} (${licenseStore.error})`
})

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return t('license.free')
  const yuan = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
  return `${currency} ${yuan}`
}

const startCountdown = (minutes: number) => {
  countdownEnd.value = Date.now() + minutes * 60 * 1000
  clearInterval(countdownInterval.value ?? undefined)
  countdownInterval.value = setInterval(() => {
    if (Date.now() >= countdownEnd.value) {
      clearInterval(countdownInterval.value ?? undefined)
      countdownInterval.value = null
    }
  }, 1000)
}

const stopCountdown = () => {
  clearInterval(countdownInterval.value ?? undefined)
  countdownInterval.value = null
  countdownEnd.value = 0
  pendingOrderId.value = null
  pendingQrUrl.value = ''
  paymentStore.cancelPoll()
}

const show = (): void => {
  showDialog.value = true
  bus.emit('editor-blur')
}

const close = (): void => {
  showDialog.value = false
  stopCountdown()
}

const handleActivate = async (): Promise<void> => {
  if (await licenseStore.activate(key.value)) {
    key.value = ''
  }
}

const handleDeactivate = async (): Promise<void> => {
  await licenseStore.deactivate()
  ElMessage.success(t('license.deactivated'))
}

const handlePay = async (): Promise<void> => {
  if (!selectedPlan.value || !paymentEmail.value.trim()) return
  payLoading.value = true
  stopCountdown()
  try {
    const result = await paymentStore.checkout(
      selectedPlan.value,
      paymentEmail.value.trim(),
      selectedMethod.value
    )
    if (result.ok) {
      if (result.licenseKey) {
        ElMessage.success(t('license.activated'))
        await licenseStore.refresh()
      } else if (result.orderId) {
        pendingOrderId.value = result.orderId
        if (result.qrUrl) {
          pendingQrUrl.value = result.qrUrl
          // 支付宝 15 分钟，微信 2 分钟
          const mins = selectedMethod.value === 'wechat' ? 2 : 15
          startCountdown(mins)
          // 自动轮询支付状态
          paymentStore.pollOrder(result.orderId, async (order) => {
            if (order.status === 'licensed' && order.licenseKey) {
              await licenseStore.activate(order.licenseKey)
              ElMessage.success(t('license.activated'))
              stopCountdown()
            }
          })
        }
      }
    } else {
      ElMessage.error(t('license.checkoutError'))
    }
  } finally {
    payLoading.value = false
  }
}

const handlePollNow = async (): Promise<void> => {
  if (!pendingOrderId.value) return
  const order = await paymentStore.refreshOrder(pendingOrderId.value)
  if (order?.status === 'licensed' && order.licenseKey) {
    await licenseStore.activate(order.licenseKey)
    ElMessage.success(t('license.activated'))
    stopCountdown()
  }
}

const handleOpenWeb = (): void => {
  window.electron?.shell?.openExternal?.('https://markweave.app/pricing')
}

const switchAuthMode = (mode: 'login' | 'register'): void => {
  authMode.value = mode
  authError.value = ''
}

const handleAuthSubmit = async (): Promise<void> => {
  authError.value = ''
  authLoading.value = true
  try {
    if (authMode.value === 'register') {
      const ok = await authStore.register(authEmail.value, authPassword.value, authDisplayName.value)
      if (ok) {
        ElMessage.success(t('license.registerSuccess'))
        authEmail.value = ''
        authPassword.value = ''
        authDisplayName.value = ''
      } else {
        authError.value = authStore.error ?? t('license.registerFailed')
      }
    } else {
      const ok = await authStore.login(authEmail.value, authPassword.value)
      if (ok) {
        ElMessage.success(t('license.loginSuccess'))
        authEmail.value = ''
        authPassword.value = ''
      } else {
        authError.value = authStore.error ?? t('license.loginFailed')
      }
    }
  } finally {
    authLoading.value = false
  }
}

const handleOAuth = async (provider: 'google' | 'github'): Promise<void> => {
  const url = await authStore.startOAuth(provider)
  if (url) {
    window.electron?.shell?.openExternal?.(url)
  }
}

const handleLinkLicense = async (): Promise<void> => {
  const licenseKey = key.value.trim()
  if (!licenseKey) {
    ElMessage.warning(t('license.enterLicenseKey'))
    return
  }
  authLoading.value = true
  try {
    const ok = await authStore.linkLicense(licenseKey)
    if (ok) {
      ElMessage.success(t('license.licenseLinked'))
      key.value = ''
    } else {
      ElMessage.error(authStore.error ?? t('license.linkFailed'))
    }
  } finally {
    authLoading.value = false
  }
}

// 取消支付时停止轮询
watch(pendingOrderId, (val) => {
  if (!val) stopCountdown()
})

onMounted(async () => {
  bus.on('activationDialog', show)
  plans.value = await paymentStore.init() || []
})

onBeforeUnmount(() => {
  bus.off('activationDialog', show)
  stopCountdown()
})
</script>

<style scoped>
.activation-dialog .title {
  font-size: 16px;
  font-weight: 600;
}

.auth-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-hint {
  font-size: 12px;
  color: var(--editorColor60);
  margin: 0;
  text-align: center;
}

.auth-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.account-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.upgrade-section,
.pay-qr-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upgrade-hint {
  margin: 0;
  font-size: 13px;
  color: var(--editorColor60);
}

.plan-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.plan-card {
  padding: 14px 12px;
  border: 2px solid var(--el-border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.plan-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.plan-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.plan-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.plan-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.plan-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.email-input {
  margin-top: 4px;
}

/* 支付方式选择 */
.pay-method-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pay-method-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.pay-method-buttons {
  display: flex;
  gap: 8px;
}

.method-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  margin-right: 4px;
}

.alipay-icon { background: #1677ff; }
.wechat-icon { background: #07c160; }
.creem-icon { background: #635bff; }

/* 二维码支付区 */
.pay-qr-section {
  align-items: center;
  padding: 8px 0;
}

.pay-qr-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--el-text-color-regular);
}

.qr-container {
  display: flex;
  justify-content: center;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  width: 200px;
  height: 200px;
  align-items: center;
}

.qr-image {
  width: 180px;
  height: 180px;
  object-fit: contain;
  display: block;
}

.qr-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.countdown {
  font-family: monospace;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-warning);
}

.manual-hint {
  font-size: 13px;
  color: var(--editorColor60);
  margin: 0;
}

.key-input {
  font-family: monospace;
  font-size: 13px;
}

.err {
  margin-top: 4px;
}

.btn-row {
  display: flex;
  gap: 8px;
}

.meta {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.meta .label {
  font-weight: 600;
  margin-right: 4px;
}
</style>
