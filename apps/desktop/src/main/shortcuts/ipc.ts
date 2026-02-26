import { ipcMain } from 'electron'
import {
  SHORTCUT_IPC_CHANNELS,
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'

type ShortcutIpcService = {
  list: () => ShortcutBindings
  update: (actionId: ShortcutActionId, accelerator: string) => Promise<ShortcutUpdateResult>
  reset: (actionId: ShortcutActionId) => Promise<void>
  resetAll: () => Promise<void>
}

function removeShortcutHandlers(): void {
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.list)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.update)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.reset)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.resetAll)
}

export function registerShortcutsIpc(service: ShortcutIpcService): () => void {
  removeShortcutHandlers()

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.list, () => {
    return service.list()
  })

  ipcMain.handle(
    SHORTCUT_IPC_CHANNELS.update,
    (_event, actionId: ShortcutActionId, accelerator: string) => {
      return service.update(actionId, accelerator)
    }
  )

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.reset, (_event, actionId: ShortcutActionId) => {
    return service.reset(actionId)
  })

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.resetAll, () => {
    return service.resetAll()
  })

  return () => {
    removeShortcutHandlers()
  }
}
