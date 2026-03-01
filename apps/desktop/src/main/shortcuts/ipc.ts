import { ipcMain } from 'electron'
import {
  SHORTCUT_IPC_CHANNELS,
  type ShortcutActionId,
  type ShortcutProfile,
  type ShortcutRuleImport,
  type ShortcutRulePatch,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'

type ShortcutIpcService = {
  list: () => ShortcutProfile
  update: (actionId: ShortcutActionId, patch: ShortcutRulePatch) => Promise<ShortcutUpdateResult>
  reset: (actionId: ShortcutActionId) => Promise<void>
  resetAll: () => Promise<void>
  replaceAll: (rules: ShortcutRuleImport[]) => Promise<ShortcutUpdateResult>
  execute: (actionId: ShortcutActionId) => Promise<void>
}

function removeShortcutHandlers(): void {
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.list)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.update)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.reset)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.resetAll)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.replaceAll)
  ipcMain.removeHandler(SHORTCUT_IPC_CHANNELS.execute)
}

export function registerShortcutsIpc(service: ShortcutIpcService): () => void {
  removeShortcutHandlers()

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.list, () => {
    return service.list()
  })

  ipcMain.handle(
    SHORTCUT_IPC_CHANNELS.update,
    (_event, actionId: ShortcutActionId, patch: ShortcutRulePatch) => {
      return service.update(actionId, patch)
    }
  )

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.reset, (_event, actionId: ShortcutActionId) => {
    return service.reset(actionId)
  })

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.resetAll, () => {
    return service.resetAll()
  })

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.replaceAll, (_event, rules: ShortcutRuleImport[]) => {
    return service.replaceAll(rules)
  })

  ipcMain.handle(SHORTCUT_IPC_CHANNELS.execute, (_event, actionId: ShortcutActionId) => {
    return service.execute(actionId)
  })

  return () => {
    removeShortcutHandlers()
  }
}
