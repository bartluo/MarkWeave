import { ipcMain, shell, clipboard } from 'electron'
import log from 'electron-log'
import * as plist from 'plist'
import path from 'path'
import { isDangerousExecutableFile } from 'common/filesystem/paths'

// `shell.openExternal` hands the URL to the OS. Only allow schemes that are
// safe to delegate — `file://` would let a compromised renderer launch local
// binaries, and arbitrary custom schemes can invoke registered protocol
// handlers with attacker-controlled arguments.
const SAFE_EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

const isSafeExternalUrl = (url: unknown): url is string => {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false
  try {
    const parsed = new URL(url)
    return SAFE_EXTERNAL_SCHEMES.has(parsed.protocol)
  } catch {
    return false
  }
}

const isSafeLocalPath = (p: unknown): string | null => {
  if (typeof p !== 'string' || p.length === 0 || p.includes('\0') || !path.isAbsolute(p)) return null
  const resolved = path.resolve(p)
  return resolved
}

export const registerShellHandlers = (): void => {
  ipcMain.handle('mt::shell::open-external', async(_e, url: string) => {
    if (!isSafeExternalUrl(url)) {
      log.warn('shell.openExternal blocked unsafe URL:', url)
      return false
    }
    try {
      await shell.openExternal(url)
      return true
    } catch (err) {
      log.error('shell.openExternal failed:', err)
      return false
    }
  })
  ipcMain.on('mt::shell::open-external', (_e, url: string) => {
    if (!isSafeExternalUrl(url)) {
      log.warn('shell.openExternal blocked unsafe URL:', url)
      return
    }
    shell.openExternal(url).catch((err) => log.error('shell.openExternal failed:', err))
  })
  ipcMain.on('mt::shell::show-item', (_e, fullPath: string) => {
    try {
      shell.showItemInFolder(fullPath)
    } catch (err) {
      log.error('shell.showItemInFolder failed:', err)
    }
  })
  ipcMain.handle('mt::shell::open-path', async(_e, fullPath: string) => {
    const resolved = isSafeLocalPath(fullPath)
    if (!resolved) {
      log.warn('shell.openPath blocked invalid path:', fullPath)
      return 'BLOCKED'
    }
    if (isDangerousExecutableFile(resolved)) {
      log.warn('shell.openPath blocked dangerous executable:', resolved)
      return 'BLOCKED'
    }
    try {
      return await shell.openPath(resolved)
    } catch (err) {
      log.error('shell.openPath failed:', err)
      return String(err instanceof Error ? err.message : err)
    }
  })

  ipcMain.on('mt::clipboard::write-text', (_e, text: string) => {
    try {
      clipboard.writeText(text)
    } catch (err) {
      log.error('clipboard.writeText failed:', err)
    }
  })
  ipcMain.handle('mt::clipboard::read-text', () => {
    try {
      return clipboard.readText()
    } catch {
      return ''
    }
  })

  ipcMain.handle('mt::clipboard::guess-file-path', () => {
    try {
      if (process.platform === 'darwin') {
        if (clipboard.has('NSFilenamesPboardType')) {
          const parsed = plist.parse(clipboard.read('NSFilenamesPboardType'))
          return Array.isArray(parsed) && parsed.length ? parsed[0] : ''
        }
        return ''
      }
      if (process.platform === 'win32') {
        const raw = clipboard.read('FileNameW')
        const filePath = raw ? raw.replace(new RegExp(String.fromCharCode(0), 'g'), '') : ''
        return typeof filePath === 'string' ? filePath : ''
      }
      return ''
    } catch (err) {
      log.error('clipboard.guess-file-path failed:', err)
      return ''
    }
  })
}
