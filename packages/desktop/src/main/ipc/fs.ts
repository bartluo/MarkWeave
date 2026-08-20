import fs from 'fs-extra'
import path from 'path'
import { statSync, constants, type Stats } from 'fs'
import { ipcMain } from 'electron'
import { isFile as commonIsFile, isDirectory as commonIsDirectory } from 'common/filesystem'

interface SerializedStat {
  size: number
  mtimeMs: number
  ctimeMs: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

const serializeStat = (stats: Stats): SerializedStat => ({
  size: stats.size,
  mtimeMs: stats.mtimeMs,
  ctimeMs: stats.ctimeMs,
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory(),
  isSymbolicLink: stats.isSymbolicLink()
})

// ── Path validation ────────────────────────────────────────────────────────
// These handlers are reachable from the renderer over IPC. Even with the
// preload channel allowlist, a compromised renderer (e.g. XSS in rendered
// Markdown) could invoke them with attacker-controlled paths. We therefore
// validate every path before touching the filesystem:
//   - must be a non-empty string (no objects/arrays/numbers)
//   - must not contain NUL bytes (breaks native fs calls / C interop)
//   - is resolved to an absolute, normalized path so every handler works
//     with a canonical path (this is input hygiene, not a sandbox)
export const assertSafePath = (p: unknown, op: string): string => {
  if (typeof p !== 'string' || p.length === 0) {
    throw new Error(`[fs:${op}] invalid path: expected non-empty string`)
  }
  if (p.includes('\0')) {
    throw new Error(`[fs:${op}] invalid path: contains NUL byte`)
  }
  return path.resolve(p)
}

// Destructive operations additionally refuse a small set of well-known system
// locations. This is defense-in-depth, not a full sandbox — the app is a local
// editor and legitimately writes wherever the user opens files — but it stops
// the most damaging accidental/malicious targets.
const isProtectedSystemPath = (resolved: string): boolean => {
  const normalized = resolved.toLowerCase().replace(/[\\/]+/g, '/')
  const protectedPrefixes =
    process.platform === 'win32'
      ? ['c:/windows', 'c:/program files', 'c:/program files (x86)']
      : ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/boot', '/etc', '/lib', '/lib64']
  return protectedPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  )
}

export const assertWritablePath = (p: unknown, op: string): string => {
  const resolved = assertSafePath(p, op)
  if (isProtectedSystemPath(resolved)) {
    throw new Error(`[fs:${op}] refusing to modify protected system path: ${resolved}`)
  }
  return resolved
}

const toBuffer = (data: unknown): unknown => {
  if (data == null) return data
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (typeof data === 'string') return data
  if (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: string }).type === 'Buffer' &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return Buffer.from((data as { data: number[] }).data)
  }
  return data
}

export const registerFsHandlers = (): void => {
  ipcMain.handle('mt::fs::is-file', (_e, p: string) => commonIsFile(assertSafePath(p, 'is-file')))
  ipcMain.handle('mt::fs::is-directory', (_e, p: string) =>
    commonIsDirectory(assertSafePath(p, 'is-directory'))
  )
  ipcMain.handle('mt::fs::empty-dir', (_e, p: string) =>
    fs.emptyDir(assertWritablePath(p, 'empty-dir'))
  )
  ipcMain.handle('mt::fs::copy', (_e, src: string, dest: string) =>
    fs.copy(assertSafePath(src, 'copy-src'), assertWritablePath(dest, 'copy-dest'))
  )
  ipcMain.handle('mt::fs::ensure-dir', (_e, p: string) =>
    fs.ensureDir(assertWritablePath(p, 'ensure-dir'))
  )

  ipcMain.handle('mt::fs::output-file', (_e, p: string, data: unknown) =>
    fs.outputFile(assertWritablePath(p, 'output-file'), toBuffer(data) as string | NodeJS.ArrayBufferView)
  )
  ipcMain.handle('mt::fs::move', (_e, src: string, dest: string) =>
    fs.move(assertSafePath(src, 'move-src'), assertWritablePath(dest, 'move-dest'), { overwrite: false })
  )
  ipcMain.handle('mt::fs::stat', async(_e, p: string) => serializeStat(await fs.stat(assertSafePath(p, 'stat'))))

  ipcMain.handle('mt::fs::write-file', (_e, p: string, data: unknown) =>
    fs.writeFile(assertWritablePath(p, 'write-file'), toBuffer(data) as string | NodeJS.ArrayBufferView)
  )
  ipcMain.handle('mt::fs::read-file', async(_e, p: string, encoding?: BufferEncoding) => {
    const buf = await fs.readFile(assertSafePath(p, 'read-file'), encoding)
    return buf
  })
  ipcMain.handle('mt::fs::path-exists', (_e, p: string) => fs.pathExists(assertSafePath(p, 'path-exists')))
  ipcMain.handle('mt::fs::unlink', (_e, p: string) => fs.unlink(assertWritablePath(p, 'unlink')))
  ipcMain.handle('mt::fs::readdir', (_e, p: string) => fs.readdir(assertSafePath(p, 'readdir')))
  ipcMain.handle('mt::fs::is-executable', (_e, p: string) => {
    try {
      const stat = statSync(assertSafePath(p, 'is-executable'))
      if (process.platform === 'win32') return stat.isFile()
      return (
        stat.isFile() &&
        (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
      )
    } catch {
      return false
    }
  })
}
