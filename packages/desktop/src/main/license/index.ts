import crypto from 'node:crypto'
import os from 'node:os'
import { BrowserWindow } from 'electron'
import keytar from 'keytar'
import Store from 'electron-store'
import log from 'electron-log'
import { decodeKey, keyIdOfPayload, verifyPayload } from '@markweave/license-core'
import type {
  ActivateRequest,
  ActivateResponse,
  ActivateResult,
  DeactivateRequest,
  LicenseInfo,
  LicensePlan,
  LicenseState,
  MachineInfo,
  ValidateResponse
} from '@shared/types/license'
import { ED25519_PUBLIC_KEY_PEM } from './publicKey'

const KEYTAR_SERVICE = 'markweave'
const KEYTAR_ACCOUNT = 'license-key'
const HEARTBEAT_MS = 24 * 60 * 60 * 1000

export type LicenseFeature = 'proExport' | 'premiumThemes' | 'cloudSync'

interface LicenseManagerOptions {
  serverUrl?: string
  graceMs?: number
  allowOfflineActivation?: boolean
}

class LicenseManager {
  private publicKey: crypto.KeyObject
  private store: Store<Record<string, unknown>>
  private serverUrl: string
  private graceMs: number
  private allowOfflineActivation: boolean
  private heartbeatTimer?: NodeJS.Timeout
  private state: LicenseState

  constructor(opts?: LicenseManagerOptions) {
    this.publicKey = crypto.createPublicKey(ED25519_PUBLIC_KEY_PEM)
    this.store = new Store<Record<string, unknown>>({ name: 'license' })
    this.serverUrl = opts?.serverUrl ?? process.env.MARKWEAVE_LICENSE_SERVER ?? 'https://lic.markweave.app'
    this.graceMs = opts?.graceMs ?? 30 * 24 * 60 * 60 * 1000
    this.allowOfflineActivation =
      opts?.allowOfflineActivation ?? process.env.MARKWEAVE_LICENSE_ALLOW_OFFLINE === '1'
    this.state = { status: 'none', localVerified: false, updatedAt: Date.now() }
    // Restore is async due to keytar; fire-and-forget from constructor.
    void this.restoreState()
  }

  // ---------- 本地持久化 ----------

  private async restoreState(): Promise<void> {
    const cached = this.store.get('state') as LicenseState | undefined
    if (cached && cached.status === 'activated') {
      const last = cached.lastValidatedAt ?? cached.updatedAt
      if (!cached.onlineValidated && Date.now() - last > this.graceMs) {
        this.state = { ...cached, status: 'expired', error: 'GRACE_EXPIRED', updatedAt: Date.now() }
        return
      }
      this.state = cached
      return
    }
    let rawKey = ''
    try {
      rawKey = (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)) ?? ''
    } catch (err) {
      log.warn('keytar read failed:', err)
    }
    if (rawKey) {
      const verified = this.verifyOffline(rawKey)
      if (verified.ok) {
        this.state = { status: 'activated', license: verified.info, localVerified: true, updatedAt: Date.now() }
        return
      }
      this.state = { status: 'expired', localVerified: false, updatedAt: Date.now(), error: verified.error }
      return
    }
    this.state = { status: 'none', localVerified: false, updatedAt: Date.now() }
  }

  private persistState(rawKey?: string): void {
    this.store.set('state', this.state)
    if (rawKey === '') {
      keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT).catch(() => {})
    } else if (rawKey) {
      keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, rawKey).catch((err) => {
        log.error('keytar set failed:', err)
      })
    }
  }

  private setState(next: LicenseState, rawKey?: string): void {
    this.state = next
    this.persistState(rawKey)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('mt::license::state-changed', next)
      }
    }
  }

  // ---------- 离线验签 ----------

  private verifyOffline(rawKey: string): { ok: true; info: LicenseInfo } | { ok: false; error: string } {
    const decoded = decodeKey(rawKey)
    if (!decoded) return { ok: false, error: 'BAD_FORMAT' }
    if (!verifyPayload(this.publicKey, decoded.payload, decoded.signature)) {
      return { ok: false, error: 'INVALID_SIGNATURE' }
    }
    let data: { sub: string; plan: LicensePlan; machines: number; iat: number; exp: number; oid: string }
    try {
      data = JSON.parse(decoded.payload)
    } catch {
      return { ok: false, error: 'BAD_PAYLOAD' }
    }
    if (data.exp !== 0 && data.exp * 1000 < Date.now()) return { ok: false, error: 'EXPIRED' }
    // 校验 machines 字段合法性（服务端签发保证 >= 1；防御被篡改/异常 payload）
    if (!Number.isFinite(data.machines) || data.machines < 1) return { ok: false, error: 'BAD_PAYLOAD' }
    return {
      ok: true,
      info: {
        plan: data.plan,
        customerEmail: data.sub,
        orderId: data.oid,
        issuedAt: data.iat,
        expiresAt: data.exp,
        machineLimit: data.machines,
        keyId: keyIdOfPayload(decoded.payload)
      }
    }
  }

  // ---------- 服务器通信 ----------

  // 强化机器指纹：结合主机名、平台、CPU、内存与网卡 MAC，降低被伪造/撞库的概率
  private machineInfo(): MachineInfo {
    const cpus = os.cpus()
    const ifaces = Object.values(os.networkInterfaces()).flat()
    const mac = ifaces
      .filter((i) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
      .map((i) => i!.mac)
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
    return { fingerprint: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32) }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const res = await fetch(this.serverUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000)
      })
      return (await res.json()) as T
    } catch (err) {
      log.warn('license server unreachable:', path, err)
      return null
    }
  }

  // ---------- 对外操作 ----------

  getState(): LicenseState {
    return this.state
  }

  async activate(rawKey: string): Promise<ActivateResult> {
    const local = this.verifyOffline(rawKey)
    if (!local.ok) {
      this.setState({ status: 'invalid', localVerified: false, updatedAt: Date.now(), error: local.error })
      return { ok: false, error: local.error }
    }
    const body: ActivateRequest = { key: rawKey, machine: this.machineInfo() }
    const res = await this.postJson<ActivateResponse>('/v1/activate', body)
    if (!res) {
      if (this.allowOfflineActivation) {
        this.setState(
          {
            status: 'activated',
            license: local.info,
            localVerified: true,
            onlineValidated: false,
            lastValidatedAt: Date.now(),
            updatedAt: Date.now()
          },
          rawKey
        )
        this.startHeartbeat()
        return { ok: true, state: this.state }
      }
      return { ok: false, error: 'NETWORK' }
    }
    if (!res.ok || !res.activationId || !res.license) {
      return { ok: false, error: res.error ?? 'SERVER' }
    }
    this.setState(
      {
        status: 'activated',
        license: { ...res.license, activationId: res.activationId },
        localVerified: true,
        onlineValidated: true,
        lastValidatedAt: Date.now(),
        updatedAt: Date.now()
      },
      rawKey
    )
    this.startHeartbeat()
    return { ok: true, state: this.state }
  }

  async refresh(): Promise<LicenseState> {
    const rawKey = (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)) ?? ''
    const activationId = this.state.license?.activationId
    if (this.state.status !== 'activated' || !rawKey || !activationId) return this.state

    const res = await this.postJson<ValidateResponse>('/v1/validate', { key: rawKey, activationId })
    if (!res) {
      const last = this.state.lastValidatedAt ?? this.state.updatedAt
      if (Date.now() - last > this.graceMs) {
        this.setState({ ...this.state, status: 'expired', error: 'GRACE_EXPIRED', updatedAt: Date.now() })
      }
      return this.state
    }
    if (res.revoked || !res.ok) {
      this.setState(
        { status: 'none', localVerified: false, updatedAt: Date.now(), error: res.error ?? 'REVOKED' },
        ''
      )
      return this.state
    }
    this.setState({
      ...this.state,
      license: { ...this.state.license!, ...res.license, activationId },
      onlineValidated: true,
      lastValidatedAt: Date.now(),
      updatedAt: Date.now()
    })
    return this.state
  }

  async deactivate(): Promise<{ ok: boolean; error?: string }> {
    const activationId = this.state.license?.activationId
    if (activationId) {
      await this.postJson<unknown>('/v1/deactivate', { activationId } as DeactivateRequest)
    }
    this.setState({ status: 'none', localVerified: false, updatedAt: Date.now() }, '')
    return { ok: true }
  }

  hasFeature(feature: LicenseFeature): boolean {
    if (this.state.status !== 'activated') return false
    const plan = this.state.license?.plan ?? 'free'
    switch (feature) {
      case 'proExport':
      case 'premiumThemes':
        return plan === 'pro' || plan === 'commercial'
      case 'cloudSync':
        return plan === 'commercial'
      default:
        return false
    }
  }

  start(): void {
    this.startHeartbeat()
    void this.refresh()
  }

  private startHeartbeat(): void {
    clearTimeout(this.heartbeatTimer)
    this.heartbeatTimer = setTimeout(() => {
      void this.refresh()
      this.startHeartbeat()
    }, HEARTBEAT_MS)
  }
}

let instance: LicenseManager | null = null

export const getLicenseManager = (): LicenseManager => {
  if (!instance) {
    instance = new LicenseManager()
  }
  return instance
}

export default LicenseManager
