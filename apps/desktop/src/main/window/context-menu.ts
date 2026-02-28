import { BrowserWindow, Menu, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { existsSync, realpathSync } from 'node:fs'
import { normalize, isAbsolute } from 'node:path'

const SHOW_CHANNEL = 'context-menu:show'
const REVEAL_CHANNEL = 'context-menu:reveal-in-finder'

type ContextMenuItemInput = {
  id: string
  label: string
  separator?: boolean
  accelerator?: string
  submenu?: ContextMenuItemInput[]
}

function buildTemplate(
  items: ContextMenuItemInput[],
  onClickItem: (id: string) => void
): Electron.MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (item.separator) {
      return { type: 'separator' as const }
    }
    if (item.submenu) {
      return {
        label: item.label,
        submenu: buildTemplate(item.submenu, onClickItem)
      }
    }
    return {
      label: item.label,
      accelerator: item.accelerator,
      click: () => onClickItem(item.id)
    }
  })
}

export function registerContextMenu(): void {
  ipcMain.removeHandler(SHOW_CHANNEL)
  ipcMain.removeHandler(REVEAL_CHANNEL)

  ipcMain.handle(
    SHOW_CHANNEL,
    (event: IpcMainInvokeEvent, items: ContextMenuItemInput[]): Promise<string | null> => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window || window.isDestroyed()) return Promise.resolve(null)

      return new Promise((resolve) => {
        let clickedId: string | null = null

        const template = buildTemplate(items, (id) => {
          clickedId = id
        })

        const menu = Menu.buildFromTemplate(template)
        menu.popup({
          window,
          callback: () => resolve(clickedId)
        })
      })
    }
  )

  ipcMain.handle(REVEAL_CHANNEL, (_event: IpcMainInvokeEvent, absolutePath: string) => {
    if (typeof absolutePath !== 'string' || absolutePath.length === 0) return
    const normalized = normalize(absolutePath)
    if (!isAbsolute(normalized) || normalized.includes('\0')) return
    if (!existsSync(normalized)) return
    let resolved: string
    try {
      resolved = realpathSync(normalized)
    } catch {
      return
    }
    shell.showItemInFolder(resolved)
  })
}
