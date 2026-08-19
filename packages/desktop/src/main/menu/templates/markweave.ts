import { app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

// macOS only menu.

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.markweave.title'),
    submenu: [
      {
        label: t('menu.markweave.about'),
        click(_menuItem, focusedWindow) {
          showAboutDialog(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.markweave.checkUpdates'),
        click(_menuItem, focusedWindow) {
          actions.checkUpdates((focusedWindow as BrowserWindow | undefined) ?? null)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.markweave.preferences'),
        accelerator: keybindings.getAccelerator('file.preferences') ?? undefined,
        click() {
          actions.userSetting()
        }
      },
      {
        label: t('menu.markweave.account'),
        accelerator: keybindings.getAccelerator('file.preferences') ?? undefined,
        click() {
          actions.userSetting('account')
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.markweave.services'),
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.markweave.hide'),
        accelerator: keybindings.getAccelerator('mt.hide') ?? undefined,
        click() {
          actions.osxHide()
        }
      },
      {
        label: t('menu.markweave.hideOthers'),
        accelerator: keybindings.getAccelerator('mt.hide-others') ?? undefined,
        click() {
          actions.osxShowAll()
        }
      },
      {
        label: t('menu.markweave.showAll'),
        click() {
          actions.osxShowAll()
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.markweave.quit'),
        accelerator: keybindings.getAccelerator('file.quit') ?? undefined,
        click: app.quit
      }
    ]
  }
}
