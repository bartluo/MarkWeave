import { serve } from '@hono/node-server'
import { loadConfig } from './config.js'
import { Store } from './db/index.js'
import { DEFAULT_PLANS } from './db/types.js'
import { createApp } from './app.js'

const cfg = loadConfig()
const store = new Store(cfg.dbPath)
const app = createApp(store, cfg, DEFAULT_PLANS)

serve({ fetch: app.fetch, port: cfg.port }, (info) => {
  console.log(`[payment-server] listening on http://0.0.0.0:${info.port}`)
})
