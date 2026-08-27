import keytar from 'keytar'
import Store from 'electron-store'
import log from 'electron-log'

const KEYTAR_SERVICE = 'markweave'
const KEYTAR_ACCOUNT_ACCESS = 'access-token'
const KEYTAR_ACCOUNT_REFRESH = 'refresh-token'

// Only non-sensitive metadata is persisted to disk. Tokens themselves live in
// memory plus the OS keychain (keytar) — never in the plaintext electron-store
// file, which any local process can read.
interface TokenStoreData {
  expiresAt?: number // epoch ms
  provider?: string
  userId?: string
}

class TokenStore {
  private store: Store<TokenStoreData>
  private accessToken?: string
  private refreshToken?: string
  private migration: Promise<void>

  constructor() {
    this.store = new Store<TokenStoreData>({ name: 'auth-tokens' })
    this.migration = this.migrateLegacyPlaintextTokens()
  }

  /** Resolves once the legacy plaintext migration finished (or was skipped). */
  async migrationReady(): Promise<void> {
    await this.migration
  }

  // Older versions wrote the raw tokens into the electron-store JSON. Migrate
  // them into keytar once, then wipe the plaintext copies from disk. The
  // plaintext is only deleted after keytar confirms the write, so a keychain
  // failure cannot destroy the user's session.
  private async migrateLegacyPlaintextTokens(): Promise<void> {
    const legacy = this.store as unknown as Store<Record<string, unknown>>
    const legacyAccess = legacy.get('accessToken')
    const legacyRefresh = legacy.get('refreshToken')
    if (typeof legacyAccess !== 'string' || typeof legacyRefresh !== 'string') return
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ACCESS, legacyAccess)
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_REFRESH, legacyRefresh)
      this.accessToken = legacyAccess
      this.refreshToken = legacyRefresh
      legacy.delete('accessToken')
      legacy.delete('refreshToken')
    } catch (err) {
      log.warn('legacy token migration to keytar failed; plaintext kept for retry:', err)
    }
  }

  getAccessToken(): string | undefined {
    return this.accessToken
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken
  }

  getExpiresAt(): number | undefined {
    return this.store.get('expiresAt')
  }

  isTokenValid(): boolean {
    const expiresAt = this.getExpiresAt()
    if (!expiresAt) return false
    // Consider token valid if it expires in more than 5 minutes
    return Date.now() < expiresAt - 5 * 60 * 1000
  }

  isTokenExpired(): boolean {
    const expiresAt = this.getExpiresAt()
    if (!expiresAt) return true
    return Date.now() >= expiresAt
  }

  async saveTokens(accessToken: string, refreshToken: string, expiresInSeconds: number): Promise<void> {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.store.set('expiresAt', expiresAt)
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ACCESS, accessToken)
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_REFRESH, refreshToken)
    } catch (err) {
      log.warn('keytar save failed:', err)
    }
  }

  async saveProfile(userId: string, provider: string): Promise<void> {
    this.store.set('userId', userId)
    this.store.set('provider', provider)
  }

  getUserId(): string | undefined {
    return this.store.get('userId')
  }

  getProvider(): string | undefined {
    return this.store.get('provider')
  }

  async clearTokens(): Promise<void> {
    this.accessToken = undefined
    this.refreshToken = undefined
    this.store.delete('expiresAt')
    this.store.delete('userId')
    this.store.delete('provider')
    try {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ACCESS)
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_REFRESH)
    } catch (err) {
      log.warn('keytar delete failed:', err)
    }
  }

  /**
   * Restore tokens from keytar (secure storage, survives app restart).
   * The real expiration is taken from the persisted metadata; when it is
   * missing we do NOT fabricate a fresh validity window — the tokens are
   * restored so a refresh can be attempted, but are treated as expired.
   */
  async restoreFromKeytar(): Promise<boolean> {
    try {
      const accessToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ACCESS)
      const refreshToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_REFRESH)
      if (accessToken && refreshToken) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
        const expiresAt = this.store.get('expiresAt')
        if (!expiresAt || expiresAt <= Date.now()) {
          // Expired or unknown — mark expired; the refresh-token flow may
          // still recover the session.
          this.store.set('expiresAt', 0)
        }
        return true
      }
    } catch (err) {
      log.warn('keytar restore failed:', err)
    }
    // Keytar may be unavailable in some dev/sandbox environments. Tokens are
    // already held in memory by saveTokens(), so still restore the in-memory
    // session for the current process instead of forcing a re-login.
    if (this.accessToken && this.refreshToken) {
      const expiresAt = this.store.get('expiresAt')
      if (!expiresAt || expiresAt <= Date.now()) {
        this.store.set('expiresAt', 0)
      }
      return true
    }
    return false
  }
}

export { TokenStore }
export type { TokenStoreData }
