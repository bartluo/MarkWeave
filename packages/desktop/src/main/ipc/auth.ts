import { ipcMain } from 'electron'
import { getAuthManager } from '../auth'
import type { LoginCredentials, RegisterRequest, BillingCycle } from '@shared/types/auth'

export const registerAuthHandlers = (): void => {
  // ── 基础认证 ─────────────────────────────────────────────────────────────────
  ipcMain.handle('mt::auth::get-status', () => getAuthManager().getStatus())

  ipcMain.handle('mt::auth::login', (_e, creds: LoginCredentials) => {
    return getAuthManager().login(creds)
  })

  ipcMain.handle('mt::auth::register', (_e, req: RegisterRequest) => {
    return getAuthManager().register(req)
  })

  ipcMain.handle('mt::auth::logout', () => {
    return getAuthManager().logout()
  })

  ipcMain.handle('mt::auth::refresh-token', () => {
    return getAuthManager().refreshToken()
  })

  ipcMain.handle('mt::auth::get-profile', () => {
    return getAuthManager().getProfile()
  })

  ipcMain.handle('mt::auth::get-devices', () => {
    return getAuthManager().getDevices()
  })

  ipcMain.handle('mt::auth::activate-device', (_e, deviceName: string) => {
    return getAuthManager().activateDevice(deviceName)
  })

  ipcMain.handle('mt::auth::deactivate-device', (_e, deviceId: string) => {
    return getAuthManager().deactivateDevice(deviceId)
  })

  ipcMain.handle('mt::auth::link-account', (_e, licenseKey: string) => {
    return getAuthManager().linkAccount(licenseKey)
  })

  ipcMain.handle('mt::auth::migrate-license', (_e, licenseKey: string) => {
    return getAuthManager().migrateLicense(licenseKey)
  })

  ipcMain.handle('mt::auth::start-oauth', (_e, provider: 'google' | 'github') => {
    if (provider !== 'google' && provider !== 'github') {
      return { codeVerifier: '', authUrl: '', state: '' }
    }
    return getAuthManager().startOAuth(provider)
  })

  ipcMain.handle('mt::auth::oauth-callback', (_e, code: string, state: string, provider: 'google' | 'github') => {
    if (provider !== 'google' && provider !== 'github') {
      return { ok: false, error: 'OAUTH_FAILED' }
    }
    return getAuthManager().handleOAuthCallback(code, state, provider)
  })

  // ── 商业功能 ─────────────────────────────────────────────────────────────────
  ipcMain.handle('mt::auth::get-subscription', () => {
    return getAuthManager().getSubscription()
  })

  ipcMain.handle('mt::auth::create-subscription', (_e, planId: string, billingCycle: BillingCycle, couponCode?: string) => {
    return getAuthManager().createSubscription(planId, billingCycle, couponCode)
  })

  ipcMain.handle('mt::auth::get-coupon', (_e, code: string) => {
    return getAuthManager().getCoupon(code)
  })

  ipcMain.handle('mt::auth::create-team', (_e, name: string, description?: string) => {
    return getAuthManager().createTeam(name, description)
  })

  ipcMain.handle('mt::auth::get-team', (_e, teamId: string) => {
    return getAuthManager().getTeam(teamId)
  })

  ipcMain.handle('mt::auth::invite-team-member', (_e, teamId: string, email: string, role?: 'admin' | 'member') => {
    return getAuthManager().inviteTeamMember(teamId, email, role)
  })

  ipcMain.handle('mt::auth::accept-team-invite', (_e, code: string) => {
    return getAuthManager().acceptTeamInvite(code)
  })

  ipcMain.handle('mt::auth::get-referral', () => {
    return getAuthManager().getReferral()
  })

  ipcMain.handle('mt::auth::convert-referral', (_e, code: string, email: string) => {
    return getAuthManager().convertReferral(code, email)
  })

  ipcMain.handle('mt::auth::get-notifications', () => {
    return getAuthManager().getNotifications()
  })

  ipcMain.handle('mt::auth::get-unread-notification-count', () => {
    return getAuthManager().getUnreadNotificationCount()
  })

  ipcMain.handle('mt::auth::mark-notification-read', (_e, notificationId: string) => {
    return getAuthManager().markNotificationRead(notificationId)
  })

  ipcMain.handle('mt::auth::log-analytics', (_e, eventType: string, eventData?: Record<string, unknown>) => {
    return getAuthManager().logAnalytics(eventType, eventData)
  })
}
