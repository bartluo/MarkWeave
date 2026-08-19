<template>
  <div class="pref-account">
    <h4>{{ t('preferences.account.title') }}</h4>

    <!-- 未登录状态 -->
    <template v-if="!authStore.isAuthenticated">
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.signIn.title') }}</h6>
        </template>
        <template #children>
          <p class="hint">{{ t('preferences.account.signIn.hint') }}</p>
          <div class="auth-form">
            <el-form @submit.prevent="handleSubmit">
              <el-form-item>
                <el-input
                  v-model="form.email"
                  :placeholder="t('preferences.account.email')"
                  prefix-icon="Message"
                />
              </el-form-item>
              <el-form-item>
                <el-input
                  v-model="form.password"
                  type="password"
                  :placeholder="t('preferences.account.password')"
                  prefix-icon="Lock"
                  show-password
                />
              </el-form-item>
              <el-form-item v-if="authMode === 'register'">
                <el-input
                  v-model="form.displayName"
                  :placeholder="t('preferences.account.displayName')"
                  prefix-icon="User"
                />
              </el-form-item>
              <el-form-item v-if="authError">
                <el-alert :title="authError" type="error" :closable="false" />
              </el-form-item>
              <div class="form-actions">
                <el-button
                  type="primary"
                  :loading="authLoading"
                  @click="handleSubmit"
                >
                  {{ authMode === 'login' ? t('preferences.account.signIn.submit') : t('preferences.account.register.submit') }}
                </el-button>
                <el-button @click="toggleAuthMode">
                  {{ authMode === 'login' ? t('preferences.account.register.switch') : t('preferences.account.signIn.switch') }}
                </el-button>
              </div>
            </el-form>
          </div>
          <div class="oauth-divider">
            <span>{{ t('preferences.account.oauthDivider') }}</span>
          </div>
          <div class="oauth-buttons">
            <el-button @click="handleOAuth('google')">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </el-button>
            <el-button @click="handleOAuth('github')">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              GitHub
            </el-button>
          </div>
        </template>
      </compound>

      <!-- 关联本地许可证 -->
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.linkLicense.title') }}</h6>
        </template>
        <template #children>
          <p class="hint">{{ t('preferences.account.linkLicense.hint') }}</p>
          <div class="link-form">
            <el-input
              v-model="linkKey"
              :placeholder="t('preferences.account.linkLicense.placeholder')"
            />
            <el-button
              type="primary"
              :loading="linkLoading"
              @click="handleLinkLicense"
            >
              {{ t('preferences.account.linkLicense.submit') }}
            </el-button>
          </div>
        </template>
      </compound>
    </template>

    <!-- 已登录状态 -->
    <template v-else>
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.profile.title') }}</h6>
        </template>
        <template #children>
          <div class="profile-info">
            <div class="avatar">{{ (authStore.displayName || authStore.email)[0].toUpperCase() }}</div>
            <div class="details">
              <p class="name">{{ authStore.displayName || authStore.email }}</p>
              <p class="email">{{ authStore.email }}</p>
              <p v-if="authStore.hasCloudLicense" class="plan-badge">{{ currentPlanLabel }}</p>
            </div>
            <el-button size="small" @click="handleLogout">{{ t('preferences.account.logout') }}</el-button>
          </div>
        </template>
      </compound>

      <!-- 订阅信息 -->
      <compound v-if="subscription">
        <template #head>
          <h6 class="title">{{ t('preferences.account.subscription.title') }}</h6>
        </template>
        <template #children>
          <div class="subscription-info">
            <p><span class="label">{{ t('preferences.account.subscription.plan') }}:</span> {{ subscription.planType }}</p>
            <p><span class="label">{{ t('preferences.account.subscription.status') }}:</span>
              <el-tag :type="subscriptionStatusTag(subscription.status)" size="small">
                {{ subscription.status }}
              </el-tag>
            </p>
            <p v-if="subscription.expiresAt"><span class="label">{{ t('preferences.account.subscription.expiresAt') }}:</span> {{ formatTime(subscription.expiresAt) }}</p>
            <p><span class="label">{{ t('preferences.account.subscription.billingCycle') }}:</span> {{ subscription.billingCycle }}</p>
          </div>
          <el-button type="primary" size="small" @click="handleUpgrade">
            {{ t('preferences.account.subscription.upgrade') }}
          </el-button>
        </template>
      </compound>

      <!-- 设备管理 -->
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.devices.title') }}</h6>
        </template>
        <template #children>
          <div class="devices-list">
            <div v-if="devicesLoading" class="loading">{{ t('common.loading') }}</div>
            <div v-else-if="deviceList?.devices?.length" v-for="(d, i) in deviceList.devices" :key="i" class="device-item">
              <span class="device-name">{{ d.name || d.fingerprint.slice(0, 8) }}</span>
              <span class="device-meta">{{ formatTime(d.lastActiveAt) }} · {{ d.isActive ? t('preferences.account.devices.active') : t('preferences.account.devices.inactive') }}</span>
              <el-button v-if="!d.isActive" size="small" @click="handleDeactivateDevice(d.deviceId)">
                {{ t('preferences.account.devices.deactivate') }}
              </el-button>
            </div>
            <div v-else class="empty">{{ t('preferences.account.devices.empty') }}</div>
          </div>
          <el-button size="small" @click="handleRefreshDevices">
            {{ t('preferences.account.devices.refresh') }}
          </el-button>
        </template>
      </compound>

      <!-- 优惠券 -->
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.coupon.title') }}</h6>
        </template>
        <template #children>
          <div class="coupon-form">
            <el-input v-model="couponCode" :placeholder="t('preferences.account.coupon.placeholder')" />
            <el-button type="primary" size="small" @click="handleValidateCoupon">
              {{ t('preferences.account.coupon.validate') }}
            </el-button>
          </div>
          <div v-if="couponResult" class="coupon-result">
            <el-alert
              :title="couponResult.valid ? `✅ ${couponResult.coupon?.name}` : `❌ ${t('preferences.account.coupon.invalid')}`"
              :type="couponResult.valid ? 'success' : 'error'"
              :closable="false"
            />
          </div>
        </template>
      </compound>

      <!-- 推荐系统 -->
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.referral.title') }}</h6>
        </template>
        <template #children>
          <div v-if="referral" class="referral-info">
            <p><span class="label">{{ t('preferences.account.referral.code') }}:</span>
              <code>{{ referral.referralCode }}</code>
              <el-button size="small" @click="copyReferralCode">
                {{ t('common.copy') }}
              </el-button>
            </p>
            <p><span class="label">{{ t('preferences.account.referral.converted') }}:</span> {{ referral.status === 'converted' ? t('common.yes') : t('common.no') }}</p>
          </div>
          <div v-else class="empty">{{ t('preferences.account.referral.generating') }}</div>
        </template>
      </compound>

      <!-- 团队 -->
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.team.title') }}</h6>
        </template>
        <template #children>
          <p class="hint">{{ t('preferences.account.team.hint') }}</p>
          <el-button size="small" @click="showCreateTeam = true">{{ t('preferences.account.team.create') }}</el-button>
        </template>
      </compound>

      <!-- 通知 -->
      <compound>
        <template #head>
          <h6 class="title">{{ t('preferences.account.notifications.title') }}</h6>
        </template>
        <template #children>
          <div class="notifications-list">
            <div v-if="notificationsLoading" class="loading">{{ t('common.loading') }}</div>
            <div v-else-if="notifications.length" v-for="n in notifications" :key="n.id" class="notification-item" :class="{ unread: !n.readAt }" @click="handleReadNotification(n.id)">
              <span class="notif-title">{{ n.title }}</span>
              <span class="notif-time">{{ formatTime(n.createdAt) }}</span>
            </div>
            <div v-else class="empty">{{ t('preferences.account.notifications.empty') }}</div>
          </div>
          <el-button size="small" @click="handleRefreshNotifications">
            {{ t('preferences.account.notifications.refresh') }}
          </el-button>
        </template>
      </compound>

      <!-- 团队创建对话框 -->
      <el-dialog v-model="showCreateTeam" :title="t('preferences.account.team.createTitle')" width="400px">
        <el-form>
          <el-form-item :label="t('preferences.account.team.name')">
            <el-input v-model="newTeamName" :placeholder="t('preferences.account.team.namePlaceholder')" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showCreateTeam = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="teamLoading" @click="handleCreateTeam">{{ t('common.confirm') }}</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import Compound from '../common/compound/index.vue'
import type { TeamDetail } from '@shared/types/auth'

const { t } = useI18n()
const authStore = useAuthStore()

// Auth form
const authMode = ref<'login' | 'register'>('login')
const form = ref({ email: '', password: '', displayName: '' })
const authLoading = ref(false)
const authError = ref('')

// License link
const linkKey = ref('')
const linkLoading = ref(false)

// OAuth
const handleOAuth = async (provider: 'google' | 'github') => {
  const url = await authStore.startOAuth(provider)
  if (url) window.electron?.shell?.openExternal?.(url)
}

// Subscription & devices
const subscription = ref<any>(null)
const deviceList = ref<any>(null)
const devicesLoading = ref(false)
const notifications = ref<any[]>([])
const notificationsLoading = ref(false)
const couponCode = ref('')
const couponResult = ref<any>(null)
const referral = ref<any>(null)
const showCreateTeam = ref(false)
const newTeamName = ref('')
const teamLoading = ref(false)

const currentPlanLabel = computed(() => {
  const labels: Record<string, string> = { pro: 'Pro', commercial: 'Commercial', trial: 'Trial', free: 'Free' }
  return labels[subscription.value?.planType ?? ''] ?? subscription.value?.planType ?? ''
})

const subscriptionStatusTag = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    active: 'success', trialing: 'warning', canceled: 'danger', expired: 'info', past_due: 'warning'
  }
  return map[status] ?? 'info'
}

const formatTime = (ts?: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString()
}

const toggleAuthMode = () => {
  authMode.value = authMode.value === 'login' ? 'register' : 'login'
  authError.value = ''
}

const handleSubmit = async () => {
  authError.value = ''
  authLoading.value = true
  try {
    if (authMode.value === 'register') {
      const ok = await authStore.register(form.value.email, form.value.password, form.value.displayName)
      if (ok) {
        ElMessage.success(t('preferences.account.signIn.success'))
        form.value = { email: '', password: '', displayName: '' }
      } else {
        authError.value = authStore.error ?? t('preferences.account.signIn.failed')
      }
    } else {
      const ok = await authStore.login(form.value.email, form.value.password)
      if (ok) {
        ElMessage.success(t('preferences.account.signIn.success'))
        form.value = { email: '', password: '', displayName: '' }
      } else {
        authError.value = authStore.error ?? t('preferences.account.signIn.failed')
      }
    }
  } finally {
    authLoading.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  ElMessage.success(t('preferences.account.logoutSuccess'))
}

const handleLinkLicense = async () => {
  if (!linkKey.value.trim()) return
  linkLoading.value = true
  try {
    const ok = await authStore.linkLicense(linkKey.value.trim())
    if (ok) {
      ElMessage.success(t('preferences.account.linkLicense.success'))
      linkKey.value = ''
    } else {
      ElMessage.error(authStore.error ?? t('preferences.account.linkLicense.failed'))
    }
  } finally {
    linkLoading.value = false
  }
}

const handleRefreshDevices = async () => {
  devicesLoading.value = true
  deviceList.value = await authStore.fetchDevices()
  devicesLoading.value = false
}

const handleDeactivateDevice = async (deviceId: string) => {
  await authStore.deactivateDevice(deviceId)
  await handleRefreshDevices()
}

const handleValidateCoupon = async () => {
  if (!couponCode.value.trim()) return
  couponResult.value = await authStore.getCoupon(couponCode.value.trim())
}

const handleCreateTeam = async () => {
  if (!newTeamName.value.trim()) return
  teamLoading.value = true
  const res = await authStore.createTeam(newTeamName.value.trim())
  teamLoading.value = false
  if (res.ok) {
    ElMessage.success(t('preferences.account.team.created'))
    showCreateTeam.value = false
    newTeamName.value = ''
  } else {
    ElMessage.error(res.error ?? t('preferences.account.team.createFailed'))
  }
}

const copyReferralCode = () => {
  navigator.clipboard?.writeText(referral.value?.referralCode ?? '')
  ElMessage.success(t('common.copied'))
}

const handleRefreshNotifications = async () => {
  notificationsLoading.value = true
  notifications.value = await authStore.getNotifications()
  notificationsLoading.value = false
}

const handleReadNotification = async (id: string) => {
  await authStore.markNotificationRead(id)
  await handleRefreshNotifications()
}

const handleUpgrade = () => {
  window.electron?.shell?.openExternal?.('https://markweave.app/pricing')
}

onMounted(async () => {
  if (!authStore.isAuthenticated) return
  subscription.value = await authStore.getSubscription()
  await handleRefreshDevices()
  await handleRefreshNotifications()
  referral.value = await authStore.getReferral()
})
</script>

<style scoped>
.pref-account .title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
}

.hint {
  font-size: 12px;
  color: var(--editorColor60);
  margin: 0 0 12px;
}

.auth-form {
  max-width: 320px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.oauth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: var(--editorColor60);
  font-size: 12px;
}
.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--editorColor20);
}

.oauth-buttons {
  display: flex;
  gap: 8px;
}

.link-form {
  display: flex;
  gap: 8px;
}
.link-form .el-input { flex: 1; }

.profile-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
.profile-info .avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--themeColor, #409eff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
}
.profile-info .details { flex: 1; }
.profile-info .name { font-size: 16px; font-weight: 600; margin: 0; }
.profile-info .email { font-size: 12px; color: var(--editorColor60); margin: 2px 0 0; }
.profile-info .plan-badge { font-size: 11px; color: var(--themeColor, #409eff); margin: 2px 0 0; }

.subscription-info p {
  margin: 4px 0;
  font-size: 13px;
}
.subscription-info .label {
  font-weight: 600;
  margin-right: 4px;
}

.devices-list, .notifications-list {
  max-height: 200px;
  overflow-y: auto;
}
.device-item, .notification-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--editorColor10);
  font-size: 13px;
  cursor: pointer;
}
.device-item:hover, .notification-item:hover {
  background: var(--editorColor05);
}
.device-meta, .notif-time {
  font-size: 11px;
  color: var(--editorColor60);
}
.notification-item.unread { font-weight: 600; }
.notification-item.unread .notif-title { color: var(--themeColor, #409eff); }

.coupon-form {
  display: flex;
  gap: 8px;
}
.coupon-form .el-input { flex: 1; }

.referral-info code {
  background: var(--editorBgColor2);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  margin: 0 4px;
}

.loading, .empty {
  font-size: 12px;
  color: var(--editorColor60);
  padding: 8px 0;
}
</style>
