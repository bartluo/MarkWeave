import { registerBootInfo } from './bootInfo'
import { registerFsHandlers } from './fs'
import { registerPathHandlers } from './paths'
import { registerRipgrepHandlers } from './ripgrep'
import { registerUploaderHandlers } from './uploader'
import { registerFontsHandlers } from './fonts'
import { registerShellHandlers } from './shell'
import { registerWindowHandlers } from './window'
import { registerCmdHandlers } from './cmd'
import { registerI18nHandlers } from './i18n'
import { registerLicenseHandlers } from './license'
import { registerPaymentHandlers } from './payment'
import { registerAuthHandlers } from './auth'

export const registerSandboxIpcHandlers = (
  getUploaderPreferences?: () => { currentUploader: string; cliScript: string }
): void => {
  registerBootInfo()
  registerFsHandlers()
  registerPathHandlers()
  registerRipgrepHandlers()
  registerUploaderHandlers(getUploaderPreferences)
  registerFontsHandlers()
  registerShellHandlers()
  registerWindowHandlers()
  registerCmdHandlers()
  registerI18nHandlers()
  registerLicenseHandlers()
  registerPaymentHandlers()
  registerAuthHandlers()
}
