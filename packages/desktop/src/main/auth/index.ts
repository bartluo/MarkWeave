import crypto from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { BrowserWindow } from 'electron'
import log from 'electron-log'
import { getLicenseManager, type LicenseFeature } from '../license'
import type {
  AuthStatus,
  AuthResult,
  LoginCredentials,
  RegisterRequest,
  UserProfile,
  DeviceList,
  OAuthChallenge,
  OAuthTokenResponse,
  LinkAccountResult,
  MigrateLicenseResult,
  UserSubscription,
  BillingCycle,
  TeamDetail,
  Notification,
  Referral,
  CouponInfo
} from '@shared/types/auth'
import { TokenStore } from './tokenStore'

const AUTH_SERVER_URL =
  process.env.MARKWEAVE_AUTH_SERVER ?? 'https://auth.markweave.app'

class AuthManager {
  private tokenStore: TokenStore
  private serverUrl: string
  private state: AuthStatus
  private refreshTimer?: NodeJS.Timeout
  // Pending OAuth challenge, kept to validate the CSRF `state` when the
  // authorization code comes back, plus the loopback redirect we told the
  // provider about.
  private pendingOAuth?: {
    state: string
    provider: 'google' | 'github'
    redirectUri: string
  }

  constructor() {
    this.tokenStore = new TokenStore()
    this.serverUrl = AUTH_SERVER_URL
    this.state = {
      authenticated: false,
      hasLocalLicense: false,
      hasCloudLicense: false
    }
    void this.restoreState()
  }

  // ---------- 状态恢复 ----------

  private async restoreState(): Promise<void> {
    await this.tokenStore.migrationReady()
    const licenseMgr = getLicenseManager()
    const localLicense = licenseMgr.getState().status === 'activated'

    // Try to restore tokens from keytar
    const restored = await this.tokenStore.restoreFromKeytar()
    if (restored) {
      // If the access token expired while the app was closed, try a silent
      // refresh so the user stays signed in across restarts.
      if (!this.tokenStore.isTokenValid()) {
        const refreshed = await this.refreshToken().catch(() => ({ ok: false }))
        if (!refreshed.ok) {
          this.state = {
            authenticated: false,
            hasLocalLicense: localLicense,
            hasCloudLicense: false
          }
          return
        }
      }
      this.state = {
        authenticated: true,
        provider: this.tokenStore.getProvider() as AuthStatus['provider'],
        email: this.tokenStore.getUserId(),
        hasLocalLicense: localLicense,
        hasCloudLicense: true
      }
      this.startTokenRefresh()
      return
    }

    this.state = {
      authenticated: false,
      hasLocalLicense: localLicense,
      hasCloudLicense: false
    }
  }

  private emitStateChange(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('mt::auth::state-changed', this.state)
      }
    }
  }

  // ---------- Token 管理 ----------

  private startTokenRefresh(): void {
    clearTimeout(this.refreshTimer)
    const expiresAt = this.tokenStore.getExpiresAt()
    if (!expiresAt) return
    const refreshIn = Math.max(0, expiresAt - Date.now() - 5 * 60 * 1000)
    this.refreshTimer = setTimeout(() => {
      void this.refreshToken()
    }, refreshIn)
  }

  private async postJson<T>(path: string, body: unknown, token?: string): Promise<T | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(this.serverUrl + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      })
      if (!res.ok) return null
      return (await res.json()) as T
    } catch (err) {
      log.warn('auth server unreachable:', path, err)
      return null
    }
  }

  private async getJson<T>(path: string, token?: string): Promise<T | null> {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(this.serverUrl + path, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000)
      })
      if (!res.ok) return null
      return (await res.json()) as T
    } catch (err) {
      log.warn('auth server unreachable:', path, err)
      return null
    }
  }

  // ---------- 本地账号 ----------

  async register(req: RegisterRequest): Promise<AuthResult> {
    if (!this.isCloudEnabled()) {
      return { ok: false, error: 'CLOUD_DISABLED' }
    }
    const res = await this.postJson<AuthResult>('/v1/auth/register', {
      email: req.email,
      password: req.password,
      displayName: req.displayName
    })
    if (!res || !res.ok) {
      return { ok: false, error: res?.error ?? 'REGISTER_FAILED' }
    }
    await this.tokenStore.saveTokens(res.token!, res.refreshToken!, res.expiresIn!)
    await this.tokenStore.saveProfile(req.email, 'local')
    await this.restoreState()
    this.emitStateChange()
    return res
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    if (!this.isCloudEnabled()) {
      return { ok: false, error: 'CLOUD_DISABLED' }
    }
    const res = await this.postJson<AuthResult>('/v1/auth/login', {
      email: credentials.email,
      password: credentials.password
    })
    if (!res || !res.ok) {
      return { ok: false, error: res?.error ?? 'LOGIN_FAILED' }
    }
    await this.tokenStore.saveTokens(res.token!, res.refreshToken!, res.expiresIn!)
    await this.tokenStore.saveProfile(credentials.email, 'local')
    await this.restoreState()
    this.emitStateChange()
    return res
  }

  async logout(): Promise<{ ok: boolean }> {
    const token = this.tokenStore.getAccessToken()
    if (token) {
      await this.postJson<void>('/v1/auth/logout', {}, token).catch(() => {})
    }
    await this.tokenStore.clearTokens()
    this.state = {
      authenticated: false,
      hasLocalLicense: getLicenseManager().getState().status === 'activated',
      hasCloudLicense: false
    }
    this.emitStateChange()
    return { ok: true }
  }

  async refreshToken(): Promise<{ ok: boolean; token?: string }> {
    const refreshToken = this.tokenStore.getRefreshToken()
    if (!refreshToken) return { ok: false }
    const res = await this.postJson<AuthResult>('/v1/auth/refresh', { refreshToken })
    if (!res || !res.ok) {
      await this.tokenStore.clearTokens()
      this.state = {
        authenticated: false,
        hasLocalLicense: getLicenseManager().getState().status === 'activated',
        hasCloudLicense: false
      }
      this.emitStateChange()
      return { ok: false }
    }
    await this.tokenStore.saveTokens(res.token!, res.refreshToken!, res.expiresIn!)
    this.startTokenRefresh()
    return { ok: true, token: res.token }
  }

  // ---------- Profile & Devices ----------

  async getProfile(): Promise<UserProfile | null> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return null
    return this.getJson<UserProfile>('/v1/profile', token)
  }

  async getDevices(): Promise<DeviceList | null> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return null
    return this.getJson<DeviceList>('/v1/devices', token)
  }

  async activateDevice(deviceName: string): Promise<{ ok: boolean; deviceId?: string; error?: string }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const fingerprint = this.generateDeviceFingerprint()
    const res = await this.postJson<{ ok: boolean; deviceId?: string }>(
      '/v1/devices',
      { name: deviceName, fingerprint },
      token
    )
    if (!res || !res.ok) return { ok: false, error: 'DEVICE_ACTIVATE_FAILED' }
    return { ok: true, deviceId: res.deviceId }
  }

  async deactivateDevice(deviceId: string): Promise<{ ok: boolean }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return { ok: false }
    // deviceId is interpolated into the URL path — validate to prevent path
    // traversal / query injection against the auth server.
    if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(deviceId)) {
      return { ok: false }
    }
    await this.postJson<void>(`/v1/devices/${encodeURIComponent(deviceId)}`, {}, token).catch(() => {})
    return { ok: true }
  }

  // ---------- License 关联 ----------

  async linkAccount(licenseKey: string): Promise<LinkAccountResult> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const res = await this.postJson<LinkAccountResult>(
      '/v1/licenses/link',
      { licenseKey },
      token
    )
    if (!res || !res.ok) return { ok: false, error: res?.error ?? 'LINK_FAILED' }
    this.state.hasCloudLicense = true
    this.emitStateChange()
    return { ok: true }
  }

  async migrateLicense(licenseKey: string): Promise<MigrateLicenseResult> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    // First link the license
    const linkRes = await this.linkAccount(licenseKey)
    if (!linkRes.ok) return { ok: false, error: linkRes.error }
    // Then deactivate local
    const licenseMgr = getLicenseManager()
    await licenseMgr.deactivate()
    // Re-activate with cloud
    const result = await licenseMgr.activate(licenseKey)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true }
  }

  // ── 商业功能 ─────────────────────────────────────────────────────────────────

  async getSubscription(): Promise<UserSubscription | null> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return null
    return this.getJson<UserSubscription>('/v1/subscriptions/me', token)
  }

  async createSubscription(
    planId: string,
    billingCycle: BillingCycle,
    couponCode?: string
  ): Promise<{ ok: boolean; subscriptionId?: string; planType?: string; error?: string }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const res = await this.postJson<{ ok: boolean; subscriptionId?: string; planType?: string }>(
      '/v1/subscriptions',
      { planId, billingCycle, couponCode },
      token
    )
    if (!res || !res.ok) return { ok: false, error: 'SUBSCRIPTION_FAILED' }
    return { ok: true, subscriptionId: res.subscriptionId, planType: res.planType }
  }

  async getCoupon(code: string): Promise<{ valid: boolean; coupon?: CouponInfo | null }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { valid: false }
    }
    const res = await this.postJson<{ valid: boolean; coupon?: CouponInfo | null }>(
      '/v1/coupons/validate',
      { code },
      token
    )
    return res ?? { valid: false }
  }

  async createTeam(name: string, description?: string): Promise<{ ok: boolean; teamId?: string; name?: string; error?: string }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const res = await this.postJson<{ ok: boolean; teamId?: string; name?: string }>(
      '/v1/teams',
      { name, description },
      token
    )
    if (!res || !res.ok) return { ok: false, error: 'TEAM_CREATE_FAILED' }
    return { ok: true, teamId: res.teamId, name: res.name }
  }

  async getTeam(teamId: string): Promise<TeamDetail | null> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return null
    if (typeof teamId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(teamId)) return null
    return this.getJson<TeamDetail>(`/v1/teams/${encodeURIComponent(teamId)}`, token)
  }

  async inviteTeamMember(teamId: string, email: string, role?: 'admin' | 'member'): Promise<{ ok: boolean; inviteCode?: string; error?: string }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    if (typeof teamId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(teamId)) {
      return { ok: false, error: 'INVALID_TEAM_ID' }
    }
    const res = await this.postJson<{ ok: boolean; inviteCode?: string }>(
      `/v1/teams/${encodeURIComponent(teamId)}/invite`,
      { email, role },
      token
    )
    if (!res || !res.ok) return { ok: false, error: 'INVITE_FAILED' }
    return { ok: true, inviteCode: res.inviteCode }
  }

  async acceptTeamInvite(code: string): Promise<{ ok: boolean; teamId?: string; role?: string; error?: string }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const res = await this.postJson<{ ok: boolean; teamId?: string; role?: string }>(
      '/v1/teams/accept-invite',
      { code },
      token
    )
    if (!res || !res.ok) return { ok: false, error: 'INVITE_ACCEPT_FAILED' }
    return { ok: true, teamId: res.teamId, role: res.role }
  }

  async getReferral(): Promise<Referral | null> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return null
    return this.getJson<Referral>('/v1/referrals', token)
  }

  async convertReferral(code: string, email: string): Promise<{ ok: boolean; error?: string }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const res = await this.postJson<{ ok: boolean }>(
      '/v1/referrals/convert',
      { code, referredEmail: email },
      token
    )
    return res ?? { ok: false, error: 'SERVER' }
  }

  async getNotifications(): Promise<Notification[]> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return []
    return (await this.getJson<Notification[]>('/v1/notifications', token)) ?? []
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return { count: 0 }
    const res = await this.getJson<{ count: number }>('/v1/notifications/unread-count', token)
    return res ?? { count: 0 }
  }

  async markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return { ok: false }
    if (typeof notificationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(notificationId)) {
      return { ok: false }
    }
    await this.postJson<void>(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, {}, token).catch(() => {})
    return { ok: true }
  }

  async logAnalytics(eventType: string, eventData?: Record<string, unknown>): Promise<{ ok: boolean }> {
    const token = this.tokenStore.getAccessToken()
    if (!token || !this.tokenStore.isTokenValid()) return { ok: false }
    const res = await this.postJson<{ ok: boolean }>('/v1/analytics/event', { eventType, eventData }, token)
    return res ?? { ok: false }
  }

  // ---------- OAuth ----------

  async startOAuth(provider: 'google' | 'github'): Promise<OAuthChallenge> {
    if (!this.isCloudEnabled() || (provider !== 'google' && provider !== 'github')) {
      return { codeVerifier: '', authUrl: '', state: '' }
    }

    // Listen on a random loopback port so the browser can hand the code back
    // to this app instance; nobody else knows the port or state.
    const server = http.createServer()
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address() as AddressInfo
    const redirectUri = `http://127.0.0.1:${address.port}/callback`
    const state = crypto.randomBytes(16).toString('hex')

    const authUrl = await this.getJson<{ authUrl: string }>(
      `/v1/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
    )
    if (!authUrl?.authUrl) {
      server.close()
      return { codeVerifier: '', authUrl: '', state: '' }
    }

    this.pendingOAuth = { state, provider, redirectUri }

    // Clean up if the user never finishes the flow.
    const oauthTimeout = setTimeout(() => {
      if (this.pendingOAuth?.state === state) {
        this.pendingOAuth = undefined
        server.close()
      }
    }, 5 * 60 * 1000)
    oauthTimeout.unref?.()

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', redirectUri)
      const code = url.searchParams.get('code') ?? ''
      const returnedState = url.searchParams.get('state') ?? ''
      const ok =
        this.pendingOAuth?.provider === provider &&
        returnedState.length === state.length &&
        crypto.timingSafeEqual(Buffer.from(returnedState), Buffer.from(state))
      if (!ok) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('OAuth state mismatch')
        this.pendingOAuth = undefined
        server.close()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body><h3>MarkWeave 登录成功，可以关闭此页面。</h3></body></html>')
      if (oauthTimeout) clearTimeout(oauthTimeout)
      this.handleOAuthCallback(code, returnedState, provider)
        .catch(() => {})
        .finally(() => server.close())
    })

    // The renderer opens this URL (it already does after startOAuth returns).
    const challenge: OAuthChallenge = {
      codeVerifier: crypto.randomBytes(32).toString('base64url'),
      authUrl: authUrl.authUrl,
      state
    }
    return challenge
  }

  async handleOAuthCallback(code: string, state: string, provider: 'google' | 'github'): Promise<AuthResult> {
    if (!this.isCloudEnabled()) return { ok: false, error: 'CLOUD_DISABLED' }
    // CSRF protection: reject callbacks whose state/provider don't match the
    // challenge we issued in startOAuth.
    if (
      !this.pendingOAuth ||
      typeof state !== 'string' ||
      state.length !== this.pendingOAuth.state.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(this.pendingOAuth.state)) ||
      provider !== this.pendingOAuth.provider
    ) {
      return { ok: false, error: 'OAUTH_STATE_MISMATCH' }
    }
    const { redirectUri } = this.pendingOAuth
    this.pendingOAuth = undefined
    if (typeof code !== 'string' || code.length === 0) {
      return { ok: false, error: 'OAUTH_FAILED' }
    }
    const res = await this.postJson<OAuthTokenResponse>('/v1/oauth/callback', {
      code,
      state,
      provider,
      redirect_uri: redirectUri
    })
    if (!res || !res.ok) return { ok: false, error: res?.error ?? 'OAUTH_FAILED' }
    await this.tokenStore.saveTokens(res.accessToken!, res.refreshToken!, res.expiresIn!)
    await this.tokenStore.saveProfile('oauth-user', `oauth:${provider}`)
    await this.restoreState()
    this.emitStateChange()
    return { ok: true, token: res.accessToken, refreshToken: res.refreshToken, expiresIn: res.expiresIn }
  }

  // ---------- 工具方法 ----------

  isCloudEnabled(): boolean {
    // Cloud mode is enabled when the auth server URL differs from the default placeholder
    // or when explicitly configured via environment variable
    const configured = process.env.MARKWEAVE_AUTH_SERVER
    if (configured) return true
    // If using the default URL, check if it's actually reachable (cloud mode)
    // For now, treat default as standalone-only
    return false
  }

  getStatus(): AuthStatus {
    return this.state
  }

  hasFeature(feature: LicenseFeature): boolean {
    // If cloud-authenticated, check server-side; otherwise fall back to local license
    if (this.state.authenticated && this.state.hasCloudLicense) {
      // Cloud user always has access to their linked features
      return true
    }
    return getLicenseManager().hasFeature(feature)
  }

  private generateDeviceFingerprint(): string {
    const os = require('node:os')
    const cpus = os.cpus()
    const ifaces = Object.values(os.networkInterfaces()).flat()
    const mac = ifaces
      .filter((i: any) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
      .map((i: any) => i.mac)
      .sort()[0] ?? ''
    const raw = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.userInfo?.().username ?? '',
      cpus[0]?.model ?? '',
      os.totalmem().toString(),
      mac
    ].join('|')
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
  }
}

let instance: AuthManager | null = null

export const getAuthManager = (): AuthManager => {
  if (!instance) {
    instance = new AuthManager()
  }
  return instance
}

export default AuthManager
