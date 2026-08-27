// Sandboxed preload: only `electron` can be required, and only a tiny subset of
// `process` is available (platform, versions, env). Everything else lives in
// the main process and is reached via IPC.
//
// All IPC traffic is funneled through the typed generics in
// `@shared/types/ipc` so channel names, argument tuples and return shapes
// are checked at the call site.

import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import pathe from 'pathe'

import type {
  IpcInvokeChannels,
  IpcSendChannels,
  IpcSyncChannels,
  IpcMainEventChannels,
  BootInfo
} from '@shared/types/ipc'
import type { LicenseState, ActivateResult } from '@shared/types/license'
import type { CheckoutOutcome, OrderInfo, PaymentPlanInfo, PaymentMethod } from '@shared/types/payment'
import type { AuthStatus, AuthResult, UserProfile, DeviceList, OAuthChallenge } from '@shared/types/auth'

type RendererEventListener<K extends keyof IpcMainEventChannels> = (
  event: IpcRendererEvent,
  ...args: IpcMainEventChannels[K]
) => void

const invoke = <K extends keyof IpcInvokeChannels>(
  channel: K,
  ...args: IpcInvokeChannels[K]['args']
): Promise<IpcInvokeChannels[K]['ret']> => ipcRenderer.invoke(channel, ...args)

const send = <K extends keyof IpcSendChannels>(channel: K, ...args: IpcSendChannels[K]): void =>
  ipcRenderer.send(channel, ...args)

// One synchronous handshake at startup so the renderer can read platform/env
// without an `await` from inside Vue computed properties etc.
const bootInfo = ipcRenderer.sendSync('mt::boot-info') as BootInfo | undefined

// ── Runtime IPC channel allowlist ──────────────────────────────────────────
// The typed generics below only enforce channel names at *compile* time. A
// compromised renderer (e.g. via an XSS in rendered Markdown) could still call
// `window.electron.ipcRenderer.invoke('<anything>')` at runtime and reach any
// handler registered in the main process. These sets mirror the contract in
// `@shared/types/ipc` and are checked on every call so only known channels are
// forwarded. Keep them in sync when adding channels to `@shared/types/ipc`.
const INVOKE_CHANNELS: ReadonlySet<string> = new Set([
  'mt::ask-for-image-path', 'mt::boot-info-async', 'mt::clipboard::guess-file-path',
  'mt::clipboard::read-text', 'mt::cmd::exists', 'mt::fonts::list', 'mt::fs-trash-item',
  'mt::fs::copy', 'mt::fs::empty-dir', 'mt::fs::ensure-dir', 'mt::fs::is-directory',
  'mt::fs::is-executable', 'mt::fs::is-file', 'mt::fs::move', 'mt::fs::output-file',
  'mt::fs::path-exists', 'mt::fs::read-file', 'mt::fs::readdir', 'mt::fs::stat',
  'mt::fs::unlink', 'mt::fs::write-file', 'mt::i18n::is-supported', 'mt::i18n::load',
  'mt::i18n::supported', 'mt::keybinding-get-keyboard-info', 'mt::keybinding-get-pref-keybindings',
  'mt::keybinding-save-user-keybindings', 'mt::license::activate', 'mt::license::deactivate',
  'mt::license::get-state', 'mt::license::has-feature', 'mt::license::refresh',
  'mt::payment::checkout', 'mt::payment::get-order', 'mt::payment::get-plans',
  'mt::auth::get-status', 'mt::auth::login', 'mt::auth::register', 'mt::auth::logout',
  'mt::auth::refresh-token', 'mt::auth::get-profile', 'mt::auth::get-devices',
  'mt::auth::activate-device', 'mt::auth::deactivate-device', 'mt::auth::link-account',
  'mt::auth::migrate-license', 'mt::auth::start-oauth', 'mt::auth::oauth-callback',
  'mt::auth::get-subscription', 'mt::auth::create-subscription', 'mt::auth::get-coupon',
  'mt::auth::create-team', 'mt::auth::get-team', 'mt::auth::invite-team-member',
  'mt::auth::accept-team-invite', 'mt::auth::get-referral', 'mt::auth::convert-referral',
  'mt::auth::get-notifications', 'mt::auth::get-unread-notification-count',
  'mt::auth::mark-notification-read', 'mt::auth::log-analytics',
  'mt::auth::desktop-start', 'mt::trial::get-state',
  'mt::auth::local-status', 'mt::auth::local-register', 'mt::auth::local-login',
  'mt::auth::local-logout', 'mt::paths::is-image',
  'mt::rg::start', 'mt::shell::open-external', 'mt::shell::open-path',
  'mt::spellchecker-get-available-dictionaries', 'mt::spellchecker-get-custom-dictionary-words',
  'mt::spellchecker-remove-word', 'mt::spellchecker-set-enabled', 'mt::spellchecker-switch-language',
  'mt::uploader::upload', 'mt::win::is-fullscreen', 'mt::win::is-maximized', 'update-buffer-state'
])

const SEND_CHANNELS: ReadonlySet<string> = new Set([
  'app-create-editor-window', 'app-create-settings-window', 'app-open-directory-by-id',
  'app-open-file-by-id', 'app-open-files-by-id', 'app-open-markdown-by-id',
  'broadcast-preferences-changed', 'broadcast-user-data-changed', 'menu-add-recently-used',
  'menu-clear-recently-used', 'mt::NEED_UPDATE', 'mt::add-recently-used-document',
  'mt::app-try-quit', 'mt::ask-for-image-auto-path', 'mt::ask-for-modify-image-folder-path',
  'mt::ask-for-open-project-in-sidebar', 'mt::ask-for-user-data', 'mt::ask-for-user-preference',
  'mt::check-for-update', 'mt::clipboard::write-text', 'mt::close-window',
  'mt::close-window-confirm', 'mt::cmd-close-window', 'mt::cmd-import-file',
  'mt::cmd-new-editor-window', 'mt::cmd-open-file', 'mt::cmd-open-folder',
  'mt::cmd-toggle-autosave', 'mt::editor-selection-changed', 'mt::format-link-click',
  'mt::get-current-language', 'mt::handle-renderer-error', 'mt::keybinding-debug-dump-keyboard-info',
  'mt::make-screenshot', 'mt::menu::popup', 'mt::menu::popup-application', 'mt::open-file',
  'mt::menu::popup-application-item', 'mt::open-file-by-window-id', 'mt::open-keybindings-config', 'mt::open-setting-window',
  'mt::rename', 'mt::request-keybindings', 'mt::set-editor-format-menus-enabled',
  'mt::response-export', 'mt::response-file-move-to', 'mt::response-file-save',
  'mt::response-file-save-as', 'mt::response-print', 'mt::rg::cancel',
  'mt::save-and-close-tabs', 'mt::save-tabs', 'mt::select-default-directory-to-open',
  'mt::set-user-data', 'mt::set-user-preference', 'mt::shell::open-external',
  'mt::shell::show-item', 'mt::update-format-menu', 'mt::update-line-ending-menu',
  'mt::update-sidebar-menu', 'mt::view-layout-changed', 'mt::win::close', 'mt::win::maximize',
  'mt::win::minimize', 'mt::win::set-fullscreen', 'mt::win::toggle-fullscreen',
  'mt::win::toggle-maximize', 'mt::win::unmaximize', 'mt::window-add-file-path',
  'mt::window-initialized', 'mt::window-tab-closed', 'mt::window-toggle-always-on-top',
  'mt::window::drop', 'screen-capture', 'set-image-folder-path', 'set-user-preference',
  'watcher-unwatch-all-by-id', 'watcher-unwatch-directory', 'watcher-unwatch-file',
  'watcher-watch-directory', 'watcher-watch-file', 'window-add-file-path',
  'window-change-file-path', 'window-close-by-id', 'window-file-saved',
  'window-reload-by-id', 'window-toggle-always-on-top'
])

const SYNC_CHANNELS: ReadonlySet<string> = new Set([
  'mt::boot-info',
  'mt::paths::is-same-sync'
])

const EVENT_CHANNELS: ReadonlySet<string> = new Set([
  'language-changed', 'mt::UPDATE_AVAILABLE', 'mt::UPDATE_DOWNLOADED', 'mt::UPDATE_ERROR',
  'mt::UPDATE_NOT_AVAILABLE', 'mt::about-dialog', 'mt::ask-for-close', 'mt::bootstrap-editor',
  'mt::cm-copy-as-html', 'mt::cm-copy-as-rich', 'mt::cm-insert-paragraph',
  'mt::cm-paste-as-plain-text', 'mt::current-language', 'mt::editor-ask-file-save',
  'mt::editor-ask-file-save-as', 'mt::editor-close-tab', 'mt::editor-edit-action',
  'mt::editor-format-action', 'mt::editor-move-file', 'mt::editor-paragraph-action',
  'mt::editor-rename-file', 'mt::execute-command-by-id', 'mt::export-success', 'mt::file-saved',
  'mt::force-close-tabs-by-id', 'mt::invalidate-image-cache', 'mt::keybindings-response',
  'mt::license::state-changed', 'mt::auth::state-changed', 'mt::load-state', 'mt::menu::click',
  'mt::menu::closed', 'mt::new-untitled-tab', 'mt::open-directory', 'mt::open-new-tab',
  'mt::pandoc-not-exists', 'mt::print-service-clearup', 'mt::rg::cancelled', 'mt::rg::done',
  'mt::rg::error', 'mt::rg::match', 'mt::rg::progress', 'mt::screenshot-captured',
  'mt::set-line-ending', 'mt::set-pathname', 'mt::set-view-layout', 'mt::show-command-palette',
  'mt::show-export-dialog', 'mt::show-notification', 'mt::spelling-replace-misspelling',
  'mt::spelling-show-switch-language', 'mt::switch-tab-by-file_path', 'mt::switch-tab-by-index',
  'mt::tab-save-failure', 'mt::tab-saved', 'mt::tabs-cycle-left', 'mt::tabs-cycle-right',
  'mt::toggle-view-layout-entry', 'mt::toggle-view-mode-entry', 'mt::update-file',
  'mt::update-object-tree', 'mt::user-preference', 'mt::window-active-status',
  'mt::window-enter-full-screen', 'mt::window-leave-full-screen', 'mt::window-maximize',
  'mt::window-unmaximize', 'mt::window-zoom', 'settings::change-tab'
])

const assertChannel = (allowed: ReadonlySet<string>, channel: string, kind: string): void => {
  if (typeof channel !== 'string' || !allowed.has(channel)) {
    throw new Error(`[preload] blocked ${kind} on non-allowlisted IPC channel: ${String(channel)}`)
  }
}

const ipcWrapper = {
  send: <K extends keyof IpcSendChannels>(channel: K, ...args: IpcSendChannels[K]): void => {
    assertChannel(SEND_CHANNELS, channel as string, 'send')
    send(channel, ...args)
  },
  sendSync: <K extends keyof IpcSyncChannels>(
    channel: K,
    ...args: IpcSyncChannels[K]['args']
  ): IpcSyncChannels[K]['ret'] => {
    assertChannel(SYNC_CHANNELS, channel as string, 'sendSync')
    return ipcRenderer.sendSync(channel, ...args)
  },
  invoke: <K extends keyof IpcInvokeChannels>(
    channel: K,
    ...args: IpcInvokeChannels[K]['args']
  ): Promise<IpcInvokeChannels[K]['ret']> => {
    assertChannel(INVOKE_CHANNELS, channel as string, 'invoke')
    return invoke(channel, ...args)
  },
  on: <K extends keyof IpcMainEventChannels>(
    channel: K,
    listener: RendererEventListener<K>
  ): (() => void) => {
    assertChannel(EVENT_CHANNELS, channel as string, 'on')
    const subscription = (event: IpcRendererEvent, ...args: unknown[]): void => {
      listener(event, ...(args as IpcMainEventChannels[K]))
    }
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  once: <K extends keyof IpcMainEventChannels>(
    channel: K,
    listener: RendererEventListener<K>
  ): (() => void) => {
    assertChannel(EVENT_CHANNELS, channel as string, 'once')
    const subscription = (event: IpcRendererEvent, ...args: unknown[]): void => {
      listener(event, ...(args as IpcMainEventChannels[K]))
    }
    ipcRenderer.once(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  removeAllListeners: (channel: keyof IpcMainEventChannels | string): void => {
    // Only allow clearing listeners for known push-event channels.
    assertChannel(EVENT_CHANNELS, channel as string, 'removeAllListeners')
    ipcRenderer.removeAllListeners(channel as string)
  }
}

const shellAPI = {
  openExternal: (url: string) => invoke('mt::shell::open-external', url),
  showItemInFolder: (fullPath: string) => send('mt::shell::show-item', fullPath),
  openPath: (fullPath: string) => invoke('mt::shell::open-path', fullPath)
}

const clipboardAPI = {
  writeText: (text: string) => send('mt::clipboard::write-text', text),
  readText: () => invoke('mt::clipboard::read-text'),
  guessFilePath: () => invoke('mt::clipboard::guess-file-path')
}

const webFrameAPI = {
  setZoomFactor: (factor: number): void => {
    if (typeof factor === 'number' && factor > 0) webFrame.setZoomFactor(factor)
  },
  setZoomLevel: (level: number): void => {
    if (typeof level === 'number') webFrame.setZoomLevel(level)
  }
}

const webUtilsAPI = {
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
}

const windowControlAPI = {
  minimize: () => send('mt::win::minimize'),
  maximize: () => send('mt::win::maximize'),
  unmaximize: () => send('mt::win::unmaximize'),
  toggleMaximize: () => send('mt::win::toggle-maximize'),
  close: () => send('mt::win::close'),
  setFullScreen: (flag: boolean) => send('mt::win::set-fullscreen', flag),
  toggleFullScreen: () => send('mt::win::toggle-fullscreen'),
  isMaximized: () => invoke('mt::win::is-maximized'),
  isFullScreen: () => invoke('mt::win::is-fullscreen'),
  popupMenu: (template: unknown, position?: { x: number; y: number }) =>
    send('mt::menu::popup', template as never, position),
  popupApplicationMenu: (position?: { x: number; y: number }) =>
    send('mt::menu::popup-application', position),
  popupApplicationMenuItem: (index: number) =>
    send('mt::menu::popup-application-item', index)
}

// These three predicates are pure path-string operations: implementing them
// in the preload keeps them synchronous so existing call sites like
// `tabs.find(t => isSamePathSync(t.pathname, ...))` keep returning the right
// item instead of a truthy Promise.
const MARKDOWN_EXTENSIONS = [
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
] as const

const hasMarkdownExtension = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(`.${ext}`))
}

const isChildOfDirectory = (dir: string, child: string): boolean => {
  if (!dir || !child) return false
  const relative = pathe.relative(dir, child)
  return !!relative && !relative.startsWith('..') && !pathe.isAbsolute(relative)
}

const isSamePathSync = (pathA: string, pathB: string, isNormalized: boolean = false): boolean => {
  if (!pathA || !pathB) return false
  const a = isNormalized ? pathA : pathe.normalize(pathA)
  const b = isNormalized ? pathB : pathe.normalize(pathB)
  if (a.length !== b.length) return false
  if (a === b) return true
  if (a.toLowerCase() === b.toLowerCase()) {
    // Case-insensitive filesystem fallback — block briefly on a sync IPC
    // because callers (tab matching) need a boolean answer right now.
    try {
      return ipcRenderer.sendSync('mt::paths::is-same-sync', a, b)
    } catch {
      return false
    }
  }
  return false
}

const fileUtilsAPI = {
  isFile: (p: string) => invoke('mt::fs::is-file', p),
  isDirectory: (p: string) => invoke('mt::fs::is-directory', p),
  emptyDir: (p: string) => invoke('mt::fs::empty-dir', p),
  copy: (src: string, dest: string) => invoke('mt::fs::copy', src, dest),
  ensureDir: (p: string) => invoke('mt::fs::ensure-dir', p),
  outputFile: (p: string, data: string | Uint8Array) => invoke('mt::fs::output-file', p, data),
  move: (src: string, dest: string) => invoke('mt::fs::move', src, dest),
  stat: (p: string) => invoke('mt::fs::stat', p),
  writeFile: (p: string, data: string | Uint8Array) => invoke('mt::fs::write-file', p, data),
  readFile: (p: string, encoding?: string) => invoke('mt::fs::read-file', p, encoding),
  pathExists: (p: string) => invoke('mt::fs::path-exists', p),
  unlink: (p: string) => invoke('mt::fs::unlink', p),
  readdir: (p: string) => invoke('mt::fs::readdir', p),
  isExecutable: (p: string) => invoke('mt::fs::is-executable', p),
  // Pure-string predicates — synchronous, no IPC for the common case.
  isChildOfDirectory,
  hasMarkdownExtension,
  isSamePathSync,
  // isImageFile needs an fs.statSync; keep it async via IPC.
  isImageFile: (p: string) => invoke('mt::paths::is-image', p),
  MARKDOWN_INCLUSIONS: bootInfo?.MARKDOWN_INCLUSIONS || []
}

const commandAPI = {
  exists: (name: string) => invoke('mt::cmd::exists', name)
}

const i18nAPI = {
  loadTranslations: (language: string) => invoke('mt::i18n::load', language)
}

type RipgrepHandler = (payload: unknown) => void
const ripgrepAPI = {
  start: (req: unknown) => invoke('mt::rg::start', req),
  cancel: (searchId: string) => send('mt::rg::cancel', searchId),
  onMatch: (handler: RipgrepHandler) => {
    const sub = (_e: IpcRendererEvent, payload: unknown) => handler(payload)
    ipcRenderer.on('mt::rg::match', sub)
    return () => ipcRenderer.removeListener('mt::rg::match', sub)
  },
  onProgress: (handler: RipgrepHandler) => {
    const sub = (_e: IpcRendererEvent, payload: unknown) => handler(payload)
    ipcRenderer.on('mt::rg::progress', sub)
    return () => ipcRenderer.removeListener('mt::rg::progress', sub)
  },
  onDone: (handler: RipgrepHandler) => {
    const sub = (_e: IpcRendererEvent, payload: unknown) => handler(payload)
    ipcRenderer.on('mt::rg::done', sub)
    return () => ipcRenderer.removeListener('mt::rg::done', sub)
  },
  onError: (handler: RipgrepHandler) => {
    const sub = (_e: IpcRendererEvent, payload: unknown) => handler(payload)
    ipcRenderer.on('mt::rg::error', sub)
    return () => ipcRenderer.removeListener('mt::rg::error', sub)
  },
  onCancelled: (handler: RipgrepHandler) => {
    const sub = (_e: IpcRendererEvent, payload: unknown) => handler(payload)
    ipcRenderer.on('mt::rg::cancelled', sub)
    return () => ipcRenderer.removeListener('mt::rg::cancelled', sub)
  }
}

const uploaderAPI = {
  uploadImage: (req: unknown) => invoke('mt::uploader::upload', req)
}

const fontsAPI = {
  list: () => invoke('mt::fonts::list')
}

const licenseAPI = {
  getState: () => invoke('mt::license::get-state'),
  activate: (licenseKey: string) => invoke('mt::license::activate', licenseKey),
  deactivate: () => invoke('mt::license::deactivate'),
  refresh: () => invoke('mt::license::refresh'),
  hasFeature: (feature: string) => invoke('mt::license::has-feature', feature),
  onStateChanged: (handler: (state: LicenseState) => void) =>
    ipcWrapper.on('mt::license::state-changed', (_e, state) => handler(state))
}

const paymentAPI = {
  getPlans: () => invoke('mt::payment::get-plans'),
  checkout: (plan: PaymentPlanInfo, email: string, method: PaymentMethod, customerName?: string) =>
    invoke('mt::payment::checkout', plan, email, method, customerName),
  getOrder: (orderId: string) => invoke('mt::payment::get-order', orderId)
}

const authAPI = {
  getStatus: () => invoke('mt::auth::get-status'),
  login: (creds: { email: string; password: string }) => invoke('mt::auth::login', creds),
  register: (req: { email: string; password: string; displayName: string }) => invoke('mt::auth::register', req),
  logout: () => invoke('mt::auth::logout'),
  refreshToken: () => invoke('mt::auth::refresh-token'),
  getProfile: () => invoke('mt::auth::get-profile'),
  getDevices: () => invoke('mt::auth::get-devices'),
  activateDevice: (name: string) => invoke('mt::auth::activate-device', name),
  deactivateDevice: (deviceId: string) => invoke('mt::auth::deactivate-device', deviceId),
  linkAccount: (licenseKey: string) => invoke('mt::auth::link-account', licenseKey),
  migrateLicense: (licenseKey: string) => invoke('mt::auth::migrate-license', licenseKey),
  startOAuth: (provider: 'google' | 'github') => invoke('mt::auth::start-oauth', provider),
  oauthCallback: (code: string, state: string, provider: 'google' | 'github') =>
    invoke('mt::auth::oauth-callback', code, state, provider),
  onStateChanged: (handler: (state: import('@shared/types/auth').AuthStatus) => void) =>
    ipcWrapper.on('mt::auth::state-changed', (_e, state) => handler(state)),
  // ── 商业功能 ─────────────────────────────────────────────────────────────────
  getSubscription: () => invoke('mt::auth::get-subscription'),
  createSubscription: (planId: string, billingCycle: import('@shared/types/auth').BillingCycle, couponCode?: string) =>
    invoke('mt::auth::create-subscription', planId, billingCycle, couponCode),
  getCoupon: (code: string) => invoke('mt::auth::get-coupon', code),
  createTeam: (name: string, description?: string) => invoke('mt::auth::create-team', name, description),
  getTeam: (teamId: string) => invoke('mt::auth::get-team', teamId),
  inviteTeamMember: (teamId: string, email: string, role?: 'admin' | 'member') =>
    invoke('mt::auth::invite-team-member', teamId, email, role),
  acceptTeamInvite: (code: string) => invoke('mt::auth::accept-team-invite', code),
  getReferral: () => invoke('mt::auth::get-referral'),
  convertReferral: (code: string, email: string) => invoke('mt::auth::convert-referral', code, email),
  getNotifications: () => invoke('mt::auth::get-notifications'),
  getUnreadNotificationCount: () => invoke('mt::auth::get-unread-notification-count'),
  markNotificationRead: (notificationId: string) => invoke('mt::auth::mark-notification-read', notificationId),
  logAnalytics: (eventType: string, eventData?: Record<string, unknown>) =>
    invoke('mt::auth::log-analytics', eventType, eventData),
  localStatus: () => invoke('mt::auth::local-status'),
  localRegister: (req: { email: string; password: string; displayName: string }) =>
    invoke('mt::auth::local-register', req),
  localLogin: (creds: { email: string; password: string }) =>
    invoke('mt::auth::local-login', creds),
  localLogout: () => invoke('mt::auth::local-logout')
}

const trialAPI = {
  getState: () => invoke('mt::trial::get-state'),
  startDesktopAuth: () => invoke('mt::auth::desktop-start')
}

const electronAPI = {
  ipcRenderer: ipcWrapper,
  shell: shellAPI,
  clipboard: clipboardAPI,
  webFrame: webFrameAPI,
  webUtils: webUtilsAPI,
  process: {
    platform: bootInfo?.platform || process.platform,
    arch: bootInfo?.arch,
    versions: bootInfo?.versions || {},
    env: bootInfo?.env || {},
    resourcesPath: bootInfo?.paths?.resources,
    cwd: bootInfo?.paths?.cwd
  },
  paths: bootInfo?.paths || {},
  isUpdatable: !!bootInfo?.isUpdatable,
  windowControl: windowControlAPI
}

// Expose a Node-`path`-compatible API to the renderer. `pathe` is a
// cross-platform reimplementation that always uses `/` separators and works
// inside a sandboxed renderer.
const pathAPI = {
  basename: (...args: Parameters<typeof pathe.basename>) => pathe.basename(...args),
  dirname: (...args: Parameters<typeof pathe.dirname>) => pathe.dirname(...args),
  extname: (...args: Parameters<typeof pathe.extname>) => pathe.extname(...args),
  join: (...args: string[]) => pathe.join(...args),
  resolve: (...args: string[]) => pathe.resolve(...args),
  relative: (...args: Parameters<typeof pathe.relative>) => pathe.relative(...args),
  isAbsolute: (...args: Parameters<typeof pathe.isAbsolute>) => pathe.isAbsolute(...args),
  normalize: (...args: Parameters<typeof pathe.normalize>) => pathe.normalize(...args),
  parse: (...args: Parameters<typeof pathe.parse>) => pathe.parse(...args),
  format: (...args: Parameters<typeof pathe.format>) => pathe.format(...args),
  sep: pathe.sep,
  delimiter: pathe.delimiter
  // Note: `pathe.posix` / `pathe.win32` are intentionally not exposed.
  // Each contains a self-reference (`pathe.posix.posix === pathe.posix`),
  // which breaks structured cloning inside `contextBridge.exposeInMainWorld`.
  // No code in this repo reads `window.path.posix` / `window.path.win32`.
}

// Bundled third-party packages occasionally read `process.platform` at module
// load time (e.g. @hfelix/electron-localshortcut/src/utils.js). Expose a
// minimal browser-safe `process` global so those imports don't throw before
// the Vue app can mount.
const processShim = {
  platform: bootInfo?.platform || process.platform,
  arch: bootInfo?.arch,
  versions: bootInfo?.versions || {},
  env: bootInfo?.env || {},
  resourcesPath: bootInfo?.paths?.resources,
  cwd: () => bootInfo?.paths?.cwd,
  // Some libraries call `process.nextTick`; map it to the microtask queue.
  nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    Promise.resolve().then(() => fn(...args))
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('process', processShim)
  contextBridge.exposeInMainWorld('rgPath', bootInfo?.paths?.ripgrepBinary || '')
  contextBridge.exposeInMainWorld('fileUtils', fileUtilsAPI)
  contextBridge.exposeInMainWorld('path', pathAPI)
  contextBridge.exposeInMainWorld('commandExists', commandAPI)
  contextBridge.exposeInMainWorld('i18nUtils', i18nAPI)
  contextBridge.exposeInMainWorld('ripgrep', ripgrepAPI)
  contextBridge.exposeInMainWorld('uploader', uploaderAPI)
  contextBridge.exposeInMainWorld('fonts', fontsAPI)
  contextBridge.exposeInMainWorld('license', licenseAPI)
  contextBridge.exposeInMainWorld('payment', paymentAPI)
  contextBridge.exposeInMainWorld('auth', authAPI)
  contextBridge.exposeInMainWorld('trial', trialAPI)
} catch {
  // Exposing any API can fail only if contextIsolation is disabled; keep the
  // bridge working silently otherwise.
}
