export interface ServerConfig {
  port: number
  dbPath: string
  privateKeyPath: string
  privateKey?: string
  adminKey: string
  trustProxy: boolean
}

export const loadConfig = (): ServerConfig => ({
  port: Number(process.env.PORT ?? 3210),
  dbPath: process.env.LICENSE_DB_PATH ?? './data/license.db',
  privateKeyPath: process.env.LICENSE_PRIVATE_KEY_PATH ?? './data/license-private.pem',
  privateKey: process.env.LICENSE_PRIVATE_KEY,
  adminKey: process.env.LICENSE_ADMIN_KEY ?? '',
  trustProxy: process.env.TRUST_PROXY === 'true'
})
