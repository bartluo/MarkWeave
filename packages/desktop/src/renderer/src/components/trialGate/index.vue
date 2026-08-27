<template>
  <div class="local-auth-gate">
    <div class="gate-card">
      <div class="gate-brand">Mark<span>Weave</span></div>
      <h2>{{ heading }}</h2>
      <p class="gate-hint">{{ hint }}</p>

      <div v-if="trial" class="trial-panel">
        <div class="trial-progress">
          <span class="trial-label">{{ trial.status === 'trial' ? '免费试用' : '离线宽限' }}</span>
          <strong>{{ remainingText }}</strong>
        </div>
      </div>

      <p v-if="message" class="gate-message gate-message--ok">{{ message }}</p>
      <p v-if="error" class="gate-message gate-message--error">{{ error }}</p>

      <button
        v-if="trial?.status === 'trial'"
        class="gate-submit"
        type="button"
        @click="continueTrial"
      >
        开始使用
      </button>
      <button
        v-else-if="trial?.status === 'grace'"
        class="gate-submit gate-submit--secondary"
        type="button"
        @click="continueTrial"
      >
        继续使用
      </button>
      <button
        v-if="trial?.status !== 'trial'"
        class="gate-submit"
        type="button"
        :disabled="openingAuth"
        @click="startDesktopAuth"
      >
        {{ openingAuth ? '正在打开注册窗口…' : '立即注册 / 登录' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { TrialState } from '@shared/types/auth'

const emit = defineEmits<{ (e: 'success'): void }>()

const trial = ref<TrialState | null>(null)
const message = ref('')
const error = ref('')
const openingAuth = ref(false)

const DAY_MS = 24 * 60 * 60 * 1000
const heading = computed(() => {
  if (trial.value?.status === 'trial') return 'MarkWeave 欢迎你'
  if (trial.value?.status === 'grace') return '试用已结束，宽限期内仍可使用'
  return '请注册后继续使用'
})
const hint = computed(() => {
  if (trial.value?.status === 'trial') return '无需注册，先享受 7 天完整功能试用。'
  if (trial.value?.status === 'grace') return '请在 3 天宽限期内完成网页注册，否则将无法继续使用。'
  return '试用已结束，请通过网页注册或登录后继续使用 MarkWeave。'
})
const remainingText = computed(() => {
  if (!trial.value) return ''
  if (trial.value.status === 'trial') {
    return `剩余 ${Math.max(1, Math.ceil(trial.value.remainingMs / DAY_MS))} 天`
  }
  return `剩余 ${Math.max(1, Math.ceil(trial.value.graceRemainingMs / DAY_MS))} 天`
})

const continueTrial = (): void => {
  emit('success')
}

const startDesktopAuth = async (): Promise<void> => {
  error.value = ''
  message.value = ''
  openingAuth.value = true
  try {
    const res = await window.trial.startDesktopAuth()
    if (!res.ok) {
      error.value = res.error === 'AUTH_SERVICE_UNAVAILABLE'
        ? '认证服务暂时不可用，请稍后重试'
        : '打开注册窗口失败，请重试'
      return
    }
    message.value = '请在弹出窗口中完成注册或登录，完成后将自动回到客户端。'
  } finally {
    openingAuth.value = false
  }
}

onMounted(async () => {
  try {
    const [trialState, status] = await Promise.all([
      window.trial.getState(),
      window.auth.getStatus()
    ])
    trial.value = trialState
    if (status.authenticated) {
      emit('success')
      return
    }
    window.auth.onStateChanged((next) => {
      if (next.authenticated) emit('success')
    })
  } catch (e) {
    console.error('trial gate init failed:', e)
    error.value = '初始化失败，请重启客户端'
  }
})
</script>

<style scoped>
.local-auth-gate {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(900px 500px at 20% -10%, rgba(34, 211, 238, 0.14), transparent 60%),
    radial-gradient(800px 500px at 90% 10%, rgba(20, 184, 166, 0.1), transparent 55%),
    #08080b;
  color: #ededf2;
  font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.gate-card {
  width: 420px;
  max-width: calc(100vw - 48px);
  padding: 34px 30px 26px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(18px);
  text-align: center;
}

.gate-brand {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 18px;
}

.gate-brand span {
  background: linear-gradient(110deg, #22d3ee, #3b82f6 52%, #14b8a6);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.gate-card h2 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
}

.gate-hint {
  margin: 0 0 18px;
  color: rgba(237, 237, 242, 0.6);
  font-size: 13px;
  line-height: 1.7;
}

.trial-panel {
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.trial-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.trial-label {
  color: rgba(237, 237, 242, 0.65);
}

.trial-progress strong {
  color: #22d3ee;
  font-weight: 700;
}

.gate-message {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.gate-message--ok {
  border: 1px solid rgba(20, 184, 166, 0.35);
  background: rgba(20, 184, 166, 0.12);
  color: #6ee7b7;
}

.gate-message--error {
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

.gate-submit {
  display: block;
  width: 100%;
  margin-top: 10px;
  height: 42px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(110deg, #22d3ee, #3b82f6 52%, #14b8a6);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.gate-submit--secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ededf2;
}

.gate-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
