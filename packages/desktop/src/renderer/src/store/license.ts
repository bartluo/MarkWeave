import { defineStore } from 'pinia'
import type { LicenseState } from '@shared/types/license'
import { setPremiumThemesEnabled } from '@/util/theme'

export interface LicenseFeatures {
  proExport: boolean
  premiumThemes: boolean
  cloudSync: boolean
}

export const useLicenseStore = defineStore('license', {
  state: () => ({
    state: null as LicenseState | null,
    loading: false,
    error: null as string | null,
    features: { proExport: false, premiumThemes: false, cloudSync: false } as LicenseFeatures
  }),

  getters: {
    isPro: (s): boolean => s.state?.status === 'activated',
    plan: (s): string => s.state?.license?.plan ?? 'free',
    hasLicense: (s): boolean => s.state?.status !== 'none' && s.state?.status !== 'invalid'
  },

  actions: {
    async init(): Promise<void> {
      if (!window.license) return
      try {
        this.state = await window.license.getState()
      } catch (e) {
        // 初始化失败不能阻断应用启动（app.vue 的 onMounted 会 await 本方法）
        console.error('license init failed:', e)
        this.error = 'INIT_FAILED'
        return
      }
      window.license.onStateChanged((next) => {
        this.state = next
        this.error = null
        void this.syncFeatures()
      })
      if (this.state?.status === 'activated') {
        await this.refresh()
      }
      await this.syncFeatures()
    },

    async syncFeatures(): Promise<void> {
      if (!window.license) return
      try {
        this.features = {
          proExport: await window.license.hasFeature('proExport'),
          premiumThemes: await window.license.hasFeature('premiumThemes'),
          cloudSync: await window.license.hasFeature('cloudSync')
        }
      } catch (e) {
        console.error('license syncFeatures failed:', e)
        return
      }
      // 防盗版：根据授权情况解锁/锁定 premium 主题
      setPremiumThemesEnabled(this.features.premiumThemes)
    },

    async refresh(): Promise<void> {
      if (!window.license) return
      try {
        this.state = await window.license.refresh()
      } catch (e) {
        // 刷新失败（如网络不可达）不应抛出：调用方多在启动路径上
        console.error('license refresh failed:', e)
        return
      }
      await this.syncFeatures()
    },

    async activate(key: string): Promise<boolean> {
      if (!window.license) return false
      this.loading = true
      this.error = null
      try {
        const res = await window.license.activate(key)
        if (!res.ok) {
          this.error = res.error ?? 'UNKNOWN'
          return false
        }
        this.state = res.state ?? null
        await this.syncFeatures()
        return true
      } catch (e) {
        console.error('license activate failed:', e)
        this.error = 'SERVER'
        return false
      } finally {
        this.loading = false
      }
    },

    async deactivate(): Promise<void> {
      if (!window.license) return
      try {
        await window.license.deactivate()
      } catch (e) {
        console.error('license deactivate failed:', e)
        return
      }
      this.state = null
      await this.syncFeatures()
    }
  }
})
