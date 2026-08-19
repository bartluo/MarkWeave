import { serve } from '@hono/node-server'
import { loadConfig } from './config'
import { loadOrCreateKeyPair } from './keys'
import { Store } from './db'
import { createApp } from './app'

const cfg = loadConfig()
const store = new Store(cfg.dbPath)
const keys = loadOrCreateKeyPair(cfg.privateKeyPath)
const app = createApp(store, cfg, keys)

serve({ fetch: app.fetch, port: cfg.port }, (info) => {
  console.log(`[license-server] listening on http://0.0.0.0:${info.port}`)
})
