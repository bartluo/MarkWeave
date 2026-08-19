import { ipcMain } from 'electron'
import { getLicenseManager, type LicenseFeature } from '../license'

export const registerLicenseHandlers = (): void => {
  ipcMain.handle('mt::license::get-state', () => getLicenseManager().getState())

  ipcMain.handle('mt::license::activate', (_e, licenseKey: string) => {
    return getLicenseManager().activate(licenseKey)
  })

  ipcMain.handle('mt::license::deactivate', () => {
    return getLicenseManager().deactivate()
  })

  ipcMain.handle('mt::license::refresh', () => {
    return getLicenseManager().refresh()
  })

  ipcMain.handle('mt::license::has-feature', (_e, feature: string) => {
    return getLicenseManager().hasFeature(feature as LicenseFeature)
  })
}
