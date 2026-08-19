import { defineStore } from 'pinia'
import type {
  AuthStatus,
  UserProfile,
  DeviceList,
  UserSubscription,
  TeamDetail,
  Notification,
  Referral,
  BillingCycle
} from '@shared/types/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    status: null as AuthStatus | null,
    profile: null as UserProfile | null,
    devices: null as DeviceList | null,
    subscription: null as UserSubscription | null,
    teams: [] as TeamDetail[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    isAuthenticated: (s): boolean => s.status?.authenticated ?? false,
    isCloudUser: (s): boolean => s.status?.provider !== undefined && s.status.authenticated,
    hasLocalLicense: (s): boolean => s.status?.hasLocalLicense ?? false,
    hasCloudLicense: (s): boolean => s.status?.hasCloudLicense ?? false,
    requiresMigration: (s): boolean => s.status?.requiresMigration ?? false,
    email: (s): string => s.status?.email ?? s.profile?.email ?? '',
    displayName: (s): string => s.status?.displayName ?? s.profile?.displayName ?? '',
    currentTeam: (s): TeamDetail | undefined => s.teams[0]
  },

  actions: {
    async init(): Promise<void> {
      if (!window.auth) return
      this.status = await window.auth.getStatus()
      window.auth.onStateChanged((next: AuthStatus) => {
        this.status = next
        this.error = null
      })
    },

    async login(email: string, password: string): Promise<boolean> {
      if (!window.auth) return false
      this.loading = true
      this.error = null
      try {
        const res = await window.auth.login({ email, password })
        if (!res.ok) {
          this.error = res.error ?? 'LOGIN_FAILED'
          return false
        }
        this.status = await window.auth.getStatus()
        return true
      } finally {
        this.loading = false
      }
    },

    async register(email: string, password: string, displayName: string): Promise<boolean> {
      if (!window.auth) return false
      this.loading = true
      this.error = null
      try {
        const res = await window.auth.register({ email, password, displayName })
        if (!res.ok) {
          this.error = res.error ?? 'REGISTER_FAILED'
          return false
        }
        this.status = await window.auth.getStatus()
        return true
      } finally {
        this.loading = false
      }
    },

    async logout(): Promise<void> {
      if (!window.auth) return
      await window.auth.logout()
      this.status = null
      this.profile = null
      this.devices = null
      this.subscription = null
      this.teams = []
    },

    async fetchProfile(): Promise<void> {
      if (!window.auth) return
      this.profile = await window.auth.getProfile()
    },

    async fetchDevices(): Promise<void> {
      if (!window.auth) return
      this.devices = await window.auth.getDevices()
    },

    async linkLicense(licenseKey: string): Promise<boolean> {
      if (!window.auth) return false
      this.loading = true
      this.error = null
      try {
        const res = await window.auth.linkAccount(licenseKey)
        if (!res.ok) {
          this.error = res.error ?? 'LINK_FAILED'
          return false
        }
        this.status = await window.auth.getStatus()
        return true
      } finally {
        this.loading = false
      }
    },

    async migrateLicense(licenseKey: string): Promise<boolean> {
      if (!window.auth) return false
      this.loading = true
      this.error = null
      try {
        const res = await window.auth.migrateLicense(licenseKey)
        if (!res.ok) {
          this.error = res.error ?? 'MIGRATE_FAILED'
          return false
        }
        this.status = await window.auth.getStatus()
        return true
      } finally {
        this.loading = false
      }
    },

    async startOAuth(provider: 'google' | 'github'): Promise<string> {
      if (!window.auth) return ''
      const challenge = await window.auth.startOAuth(provider)
      return challenge.authUrl
    },

    // ── 商业功能 ─────────────────────────────────────────────────────────────────

    async getSubscription(): Promise<UserSubscription | null> {
      if (!window.auth) return null
      return window.auth.getSubscription?.() ?? null
    },

    async createSubscription(
      planId: string,
      billingCycle: BillingCycle,
      couponCode?: string
    ): Promise<{ ok: boolean; subscriptionId?: string; planType?: string; error?: string }> {
      if (!window.auth) return { ok: false, error: 'NO_AUTH_API' }
      return window.auth.createSubscription?.(planId, billingCycle, couponCode) ?? { ok: false, error: 'NOT_SUPPORTED' }
    },

    async getCoupon(code: string): Promise<{ valid: boolean; coupon?: { type: string; value: number; name: string } | null }> {
      if (!window.auth) return { valid: false }
      return window.auth.getCoupon?.(code) ?? { valid: false }
    },

    async createTeam(name: string, description?: string): Promise<{ ok: boolean; teamId?: string; name?: string; error?: string }> {
      if (!window.auth) return { ok: false, error: 'NO_AUTH_API' }
      return window.auth.createTeam?.(name, description) ?? { ok: false, error: 'NOT_SUPPORTED' }
    },

    async getTeam(teamId: string): Promise<TeamDetail | null> {
      if (!window.auth) return null
      return window.auth.getTeam?.(teamId) ?? null
    },

    async inviteTeamMember(teamId: string, email: string, role?: 'admin' | 'member'): Promise<{ ok: boolean; inviteCode?: string; error?: string }> {
      if (!window.auth) return { ok: false, error: 'NO_AUTH_API' }
      return window.auth.inviteTeamMember?.(teamId, email, role) ?? { ok: false, error: 'NOT_SUPPORTED' }
    },

    async acceptTeamInvite(code: string): Promise<{ ok: boolean; teamId?: string; role?: string; error?: string }> {
      if (!window.auth) return { ok: false, error: 'NO_AUTH_API' }
      return window.auth.acceptTeamInvite?.(code) ?? { ok: false, error: 'NOT_SUPPORTED' }
    },

    async getReferral(): Promise<Referral | null> {
      if (!window.auth) return null
      return window.auth.getReferral?.() ?? null
    },

    async convertReferral(code: string, email: string): Promise<{ ok: boolean; error?: string }> {
      if (!window.auth) return { ok: false, error: 'NO_AUTH_API' }
      return window.auth.convertReferral?.(code, email) ?? { ok: false, error: 'NOT_SUPPORTED' }
    },

    async getNotifications(): Promise<Notification[]> {
      if (!window.auth) return []
      return window.auth.getNotifications?.() ?? []
    },

    async getUnreadNotificationCount(): Promise<{ count: number }> {
      if (!window.auth) return { count: 0 }
      return window.auth.getUnreadNotificationCount?.() ?? { count: 0 }
    },

    async markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
      if (!window.auth) return { ok: false }
      return window.auth.markNotificationRead?.(notificationId) ?? { ok: false }
    },

    async logAnalytics(eventType: string, eventData?: Record<string, unknown>): Promise<{ ok: boolean }> {
      if (!window.auth) return { ok: false }
      return window.auth.logAnalytics?.(eventType, eventData) ?? { ok: false }
    }
  }
})
