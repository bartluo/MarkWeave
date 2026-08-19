import type { RouteRecordRaw } from 'vue-router'
// .vue extensions are explicit so TS resolves them through the *.vue module
// shim in src/types/renderer.d.ts. Vite handles extension-less imports at
// runtime, but vue-tsc needs the suffix.
import App from '@/pages/app.vue'

const parseSettingsPage = (type: string | null | undefined): string => {
  let pageUrl = '/preference'
  if (type && /\/spelling$/.test(type)) {
    pageUrl += '/spelling'
  }
  return pageUrl
}

const createRoutes = (envType?: string): RouteRecordRaw[] => {
  const baseRoutes: RouteRecordRaw[] = [
    {
      path: '/',
      component: App,
      redirect: (to) => {
        const params = new URLSearchParams(window.location.search)
        const queryType = params.get('type')
        if (queryType?.includes('settings')) {
          return `/editor${parseSettingsPage(queryType)}`
        }
        if (envType?.includes('settings')) {
          return `/editor${parseSettingsPage(envType)}`
        }
        return '/editor'
      }
    },
    {
      path: '/editor',
      name: 'editor',
      component: App
    },
    {
      path: '/preference',
      name: 'preference',
      component: () => import('@/pages/preference.vue'),
      redirect: '/preference/account',
      children: [
        {
          path: 'account',
          name: 'preference-account',
          component: () => import('@/prefComponents/account/index.vue')
        },
        {
          path: 'general',
          name: 'preference-general',
          component: () => import('@/prefComponents/general/index.vue')
        },
        {
          path: 'editor',
          name: 'preference-editor',
          component: () => import('@/prefComponents/editor/index.vue')
        },
        {
          path: 'markdown',
          name: 'preference-markdown',
          component: () => import('@/prefComponents/markdown/index.vue')
        },
        {
          path: 'theme',
          name: 'preference-theme',
          component: () => import('@/prefComponents/theme/index.vue')
        },
        {
          path: 'image',
          name: 'preference-image',
          component: () => import('@/prefComponents/image/index.vue')
        },
        {
          path: 'spelling',
          name: 'preference-spelling',
          component: () => import('@/prefComponents/spellchecker/index.vue')
        },
        {
          path: 'keybindings',
          name: 'preference-keybindings',
          component: () => import('@/prefComponents/keybindings/index.vue')
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
  return baseRoutes
}

export default createRoutes
