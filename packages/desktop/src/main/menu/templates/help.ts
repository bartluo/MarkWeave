import { shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/help'
import { t } from '../../i18n'

export default function(): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.help.changelog'),
      click() {
        shell.openExternal('https://github.com/markweave/markweave/releases')
      }
    },
    {
      label: t('menu.help.followUs'),
      click() {
        shell.openExternal('https://work.weixin.qq.com/kfid/kfc55d33041a84f1321')
      }
    },
    {
      label: t('menu.help.reportBug'),
      click() {
        shell.openExternal('https://github.com/markweave/markweave/issues')
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.help.about'),
      click(_menuItem, browserWindow) {
        actions.showAboutDialog(browserWindow as BrowserWindow | undefined)
      }
    }
  ]

  const helpMenu: MenuItemConstructorOptions = {
    label: t('menu.help.help'),
    role: 'help',
    submenu
  }
  return helpMenu
}
