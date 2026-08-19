import { createApp, type App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import bootstrapRenderer from './bootstrap'
import axios from './axios'
import pinia from './store'
import './assets/symbolIcon'

// Element Plus instead of Element UI for Vue 3
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import en from 'element-plus/es/locale/lang/en'

// I18n translation system
import i18nPlugin from './i18n'

// Polyfill Node.js globals for browser preview mode
if (typeof process === 'undefined') {
  ;(globalThis as unknown as Record<string, unknown>).process = {
    platform: typeof navigator !== 'undefined' ? (navigator.platform as NodeJS.Platform) : 'win32',
    env: { NODE_ENV: 'development' }
  } as unknown as NodeJS.Process
}

// Polyfill for Electron's path module in browser context
if (typeof (window as unknown as Record<string, unknown>).path === 'undefined') {
  ;(window as unknown as Record<string, unknown>).path = {
    sep: '/',
    join(...parts: string[]) { return parts.join('/') },
    dirname(path: string) { return path.split('/').slice(0, -1).join('/') || '/' },
    basename(path: string) { return path.split('/').pop() || '' },
    extname(path: string) { const i = path.lastIndexOf('.'); return i < 0 ? '' : path.slice(i) }
  }
}

// Polyfill for Electron's ipcRenderer (no-op for browser preview)
if (typeof (window as unknown as Record<string, unknown>).electron === 'undefined') {
  ;(window as unknown as Record<string, unknown>).electron = {
    process: {
      platform: typeof navigator !== 'undefined' ? (navigator.platform as NodeJS.Platform) : 'win32',
      env: { NODE_ENV: 'development' }
    },
    ipcRenderer: {
      send(_channel: string, _args?: unknown) {},
      invoke(_channel: string, _args?: unknown) { return Promise.resolve(undefined) },
      on(_channel: string, _listener: (...args: unknown[]) => void) { return { off() {} } },
      removeListener(_channel: string, _listener: (...args: unknown[]) => void) {}
    }
  }
}

// Polyfill for locale loading (browser preview only; Electron uses the preload
// bridge). Vite resolves the JSON at build time for the two bundled locales.
if (typeof (window as unknown as Record<string, unknown>).i18nUtils === 'undefined') {
  ;(window as unknown as Record<string, unknown>).i18nUtils = {
    loadTranslations: async(language: string) => {
      try {
        const mod = await import(`../../../static/locales/${language}.json`)
        return (mod as { default?: unknown }).default ?? mod
      } catch {
        return undefined
      }
    }
  }
}

// something is wrong here! \\/
import services from './services/index'
import routes from './router'
import Main from './Main.vue'

import './assets/styles/index.css'
import './assets/styles/printService.css'

// -----------------------------------------------

window.markweave = {}
bootstrapRenderer()

// -----------------------------------------------
// Be careful when changing code before this line!

// Create Vue app
const app: App<Element> = createApp(Main)

// Configure Element Plus with locale
app.use(ElementPlus, {
  locale: en
})

const envType = window.markweave?.env?.type as string | undefined

const router = createRouter({
  history: createWebHashHistory(),
  // it seems like something might have changed in vue-router? it uses the full "file path" instead of
  // links like /editor if we use the old createWebHistory()
  routes: routes(envType)
})

app.use(router)
app.use(pinia)
app.use(i18nPlugin)

// Configure axios globally
app.config.globalProperties.$http = axios

// Register services globally
;(services as unknown as Array<Record<string, unknown> & { name: string }>).forEach((s) => {
  app.config.globalProperties['$' + s.name] = s[s.name]
})

// Mount the app
app.mount('#app')
