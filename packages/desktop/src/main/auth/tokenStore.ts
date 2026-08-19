import crypto from 'node:crypto'
import keytar from 'keytar'
import Store from 'electron-store'
import log from 'electron-log'

const KEYTAR_SERVICE = 'markweave'
const KEYTAR_ACCOUNT_ACCESS = 'access-token'
const KEYTAR_ACCOUNT_REFRESH = 'refresh-token'

interface TokenStoreData {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number // epoch ms
  provider?: string
  userId?: string
}

class TokenStore {
  private store: Store<TokenStoreData>

  constructor() {
    this.store = new Store<TokenStoreData>({ name: 'auth-tokens' })
  }

  getAccessToken(): string | undefined {
    return this.store.get('accessToken')
  }

  getRefreshToken(): string | undefined {
    return this.store.get('refreshToken')
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
    this.store.set('accessToken', accessToken)
    this.store.set('refreshToken', refreshToken)
    this.store.set('expiresAt', expiresAt)
    // Also persist in keytar for secure storage
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
    this.store.delete('accessToken')
    this.store.delete('refreshToken')
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

  /** Restore tokens from keytar (more secure, survives app restart) */
  async restoreFromKeytar(): Promise<boolean> {
    try {
      const accessToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ACCESS)
      const refreshToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_REFRESH)
      if (accessToken && refreshToken) {
        const expiresIn = 7 * 24 * 60 * 60 // 7 days default
        await this.saveTokens(accessToken, refreshToken, expiresIn)
        return true
      }
    } catch (err) {
      log.warn('keytar restore failed:', err)
    }
    return false
  }
}

export { TokenStore }
export type { TokenStoreData }
