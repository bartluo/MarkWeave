<template>
  <div class="pref-pro">
    <h4>{{ t('proPage.title') }}</h4>
    <p class="subtitle">{{ t('proPage.subtitle') }}</p>

    <div
      class="status-banner"
      :class="{ active: licenseStore.isPro }"
    >
      <template v-if="licenseStore.isPro">
        <span class="status-badge">{{ planLabel }}</span>
        <span>{{ t('proPage.activeHint') }}</span>
      </template>
      <template v-else>
        <span>{{ t('proPage.freeHint') }}</span>
        <el-button
          type="primary"
          size="small"
          @click="openUpgrade"
        >
          {{ t('proPage.upgradeNow') }}
        </el-button>
      </template>
    </div>

    <div class="plan-grid">
      <div class="plan-card">
        <h5>{{ t('proPage.planFree') }}</h5>
        <div class="plan-price">{{ t('license.free') }}</div>
        <ul>
          <li v-for="f in freeFeatures" :key="f">{{ f }}</li>
        </ul>
      </div>

      <div class="plan-card featured">
        <div class="plan-tag">{{ t('proPage.popular') }}</div>
        <h5>Pro</h5>
        <div class="plan-price">{{ proPrice }}</div>
        <ul>
          <li v-for="f in proFeatures" :key="f">{{ f }}</li>
        </ul>
        <el-button
          type="primary"
          class="plan-action"
          @click="openUpgrade"
        >
          {{ t('proPage.upgradePro') }}
        </el-button>
      </div>

      <div class="plan-card">
        <h5>{{ t('proPage.planCommercial') }}</h5>
        <div class="plan-price">{{ commercialPrice }}</div>
        <ul>
          <li v-for="f in commercialFeatures" :key="f">{{ f }}</li>
        </ul>
        <el-button
          class="plan-action"
          @click="openWeb"
        >
          {{ t('proPage.learnMore') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLicenseStore } from '@/store/license'
import { usePaymentStore } from '@/store/payment'
import bus from '../../bus'
import type { PaymentPlanInfo } from '@shared/types/payment'

const { t } = useI18n()
const licenseStore = useLicenseStore()
const paymentStore = usePaymentStore()

const plans = ref<PaymentPlanInfo[]>([])

const formatPrice = (cents: number, currency: string): string => {
  const yuan = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
  return `${currency} ${yuan}`
}

const proPrice = computed(() => {
  const p = plans.value.find((x) => x.id === 'pro')
  return p ? formatPrice(p.priceCents, p.currency) : '¥ 39'
})

const commercialPrice = computed(() => {
  const p = plans.value.find((x) => x.id === 'commercial')
  return p ? formatPrice(p.priceCents, p.currency) : '¥ 199'
})

const planLabel = computed(() => {
  switch (licenseStore.plan) {
    case 'pro': return t('license.planPro')
    case 'commercial': return t('license.planCommercial')
    case 'trial': return t('license.planTrial')
    default: return t('license.planFree')
  }
})

const freeFeatures = computed(() => [
  t('proPage.free.livePreview'),
  t('proPage.free.gfm'),
  t('proPage.free.math'),
  t('proPage.free.mermaid'),
  t('proPage.free.localSave')
])

const proFeatures = computed(() => [
  t('proPage.free.all'),
  t('proPage.pro.pdf'),
  t('proPage.pro.html'),
  t('proPage.pro.themes'),
  t('proPage.pro.plantuml'),
  t('proPage.pro.highlight')
])

const commercialFeatures = computed(() => [
  t('proPage.pro.all'),
  t('proPage.commercial.sync'),
  t('proPage.commercial.library'),
  t('proPage.commercial.history'),
  t('proPage.commercial.e2ee'),
  t('proPage.commercial.support')
])

const openUpgrade = (): void => {
  bus.emit('activationDialog')
}

const openWeb = (): void => {
  window.electron?.shell?.openExternal?.('https://markweave.app/pricing')
}

onMounted(async () => {
  plans.value = await paymentStore.init()
})
</script>

<style scoped>
.pref-pro {
  max-width: 860px;
}

.pref-pro h4 {
  margin: 0 0 6px;
}

.subtitle {
  margin: 0 0 18px;
  color: var(--editorColor60);
  font-size: 13px;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--floatBorderColor);
  border-radius: 8px;
  background: var(--floatBgColor);
  color: var(--editorColor);
  margin-bottom: 22px;
}

.status-banner.active {
  border-color: var(--brandB);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--brandB) 35%, transparent);
}

.status-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--brandGrad);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

@media (max-width: 720px) {
  .plan-grid {
    grid-template-columns: 1fr;
  }
}

.plan-card {
  position: relative;
  padding: 18px;
  border: 1px solid var(--floatBorderColor);
  border-radius: 10px;
  background: var(--floatBgColor);
  color: var(--editorColor);
}

.plan-card.featured {
  border-color: var(--brandB);
  box-shadow: 0 10px 30px -14px var(--brandGlow);
}

.plan-tag {
  position: absolute;
  top: -10px;
  right: 14px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--brandGrad);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.plan-card h5 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--editorColor80);
}

.plan-price {
  margin-bottom: 12px;
  font-size: 22px;
  font-weight: 700;
  background: var(--brandGrad);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.plan-card ul {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-card li {
  font-size: 13px;
  color: var(--editorColor60);
  padding-left: 18px;
  position: relative;
}

.plan-card li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--brandC);
  font-weight: 700;
}

.plan-action {
  width: 100%;
}
</style>
