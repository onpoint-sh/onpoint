import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  SHORTCUT_IPC_CHANNELS,
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'
import {
  NOTES_IPC_CHANNELS,
  type ArchiveNoteResult,
  type CreateFolderResult,
  type CreateNoteInput,
  type DeleteNoteResult,
  type MoveNoteResult,
  type NoteDocument,
  type NotesConfig,
  type RenameFolderResult,
  type RenameNoteResult,
  type NoteSummary,
  type SaveNoteResult
} from '@onpoint/shared/notes'
import { GHOST_MODE_IPC_CHANNELS, type GhostModeConfig } from '@onpoint/shared/ghost-mode'
import { WINDOW_IPC_CHANNELS } from '@onpoint/shared/window'

const IPC_CHANNELS = {
  minimize: 'window-controls:minimize',
  toggleMaximize: 'window-controls:toggle-maximize',
  close: 'window-controls:close',
  isMaximized: 'window-controls:is-maximized',
  zoomIn: 'window-controls:zoom-in',
  zoomOut: 'window-controls:zoom-out',
  resetZoom: 'window-controls:reset-zoom',
  getZoomFactor: 'window-controls:get-zoom-factor',
  maximizeChanged: 'window-controls:maximize-changed',
  zoomFactorChanged: 'window-controls:zoom-factor-changed'
} as const

const windowControls = {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke(IPC_CHANNELS.minimize),
  toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.toggleMaximize) as Promise<boolean>,
  close: () => ipcRenderer.invoke(IPC_CHANNELS.close),
  isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.isMaximized) as Promise<boolean>,
  zoomIn: () => ipcRenderer.invoke(IPC_CHANNELS.zoomIn),
  zoomOut: () => ipcRenderer.invoke(IPC_CHANNELS.zoomOut),
  resetZoom: () => ipcRenderer.invoke(IPC_CHANNELS.resetZoom),
  getZoomFactor: () => ipcRenderer.invoke(IPC_CHANNELS.getZoomFactor) as Promise<number>,
  onMaximizeChanged: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }

    ipcRenderer.on(IPC_CHANNELS.maximizeChanged, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.maximizeChanged, listener)
    }
  },
  onZoomFactorChanged: (callback: (zoomFactor: number) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, zoomFactor: number): void => {
      callback(zoomFactor)
    }

    ipcRenderer.on(IPC_CHANNELS.zoomFactorChanged, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.zoomFactorChanged, listener)
    }
  },
  detachTab: (relativePath: string) =>
    ipcRenderer.invoke(WINDOW_IPC_CHANNELS.detachTab, relativePath) as Promise<boolean>,
  getDetachInit: () =>
    ipcRenderer.invoke(WINDOW_IPC_CHANNELS.getDetachInit) as Promise<{
      relativePath: string
    } | null>,
  newWindow: () => ipcRenderer.invoke(WINDOW_IPC_CHANNELS.newWindow) as Promise<void>,
  getWindowId: () =>
    ipcRenderer.invoke(WINDOW_IPC_CHANNELS.getWindowId) as Promise<string | null>
}

const shortcuts = {
  list: () => ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.list) as Promise<ShortcutBindings>,
  update: (actionId: ShortcutActionId, accelerator: string) =>
    ipcRenderer.invoke(
      SHORTCUT_IPC_CHANNELS.update,
      actionId,
      accelerator
    ) as Promise<ShortcutUpdateResult>,
  reset: (actionId: ShortcutActionId) =>
    ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.reset, actionId) as Promise<void>,
  resetAll: () => ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.resetAll) as Promise<void>,
  onGlobalAction: (callback: (actionId: ShortcutActionId) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, actionId: ShortcutActionId): void => {
      callback(actionId)
    }

    ipcRenderer.on(SHORTCUT_IPC_CHANNELS.globalAction, listener)

    return () => {
      ipcRenderer.removeListener(SHORTCUT_IPC_CHANNELS.globalAction, listener)
    }
  },
  onBindingsChanged: (callback: (bindings: ShortcutBindings) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, bindings: ShortcutBindings): void => {
      callback(bindings)
    }

    ipcRenderer.on(SHORTCUT_IPC_CHANNELS.bindingsChanged, listener)

    return () => {
      ipcRenderer.removeListener(SHORTCUT_IPC_CHANNELS.bindingsChanged, listener)
    }
  }
}

const ghostMode = {
  getState: () => ipcRenderer.invoke(GHOST_MODE_IPC_CHANNELS.getState) as Promise<boolean>,
  getConfig: () =>
    ipcRenderer.invoke(GHOST_MODE_IPC_CHANNELS.getConfig) as Promise<GhostModeConfig>,
  setOpacity: (value: number) =>
    ipcRenderer.invoke(GHOST_MODE_IPC_CHANNELS.setOpacity, value) as Promise<GhostModeConfig>,
  onStateChanged: (callback: (isActive: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, isActive: boolean): void => {
      callback(isActive)
    }

    ipcRenderer.on(GHOST_MODE_IPC_CHANNELS.stateChanged, listener)

    return () => {
      ipcRenderer.removeListener(GHOST_MODE_IPC_CHANNELS.stateChanged, listener)
    }
  }
}

const contextMenu = {
  show: (items: { id: string; label: string; separator?: boolean; accelerator?: string }[]) =>
    ipcRenderer.invoke('context-menu:show', items) as Promise<string | null>,
  revealInFinder: (absolutePath: string) =>
    ipcRenderer.invoke('context-menu:reveal-in-finder', absolutePath) as Promise<void>
}

const notes = {
  getConfig: () => ipcRenderer.invoke(NOTES_IPC_CHANNELS.getConfig) as Promise<NotesConfig>,
  pickVault: () => ipcRenderer.invoke(NOTES_IPC_CHANNELS.pickVault) as Promise<string | null>,
  setVault: (vaultPath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.setVault, vaultPath) as Promise<NotesConfig>,
  listNotes: () => ipcRenderer.invoke(NOTES_IPC_CHANNELS.list) as Promise<NoteSummary[]>,
  openNote: (relativePath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.open, relativePath) as Promise<NoteDocument>,
  createNote: (input?: CreateNoteInput, parentRelativePath?: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.create, input, parentRelativePath) as Promise<NoteDocument>,
  saveNote: (relativePath: string, content: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.save, relativePath, content) as Promise<SaveNoteResult>,
  renameNote: (relativePath: string, requestedTitle: string) =>
    ipcRenderer.invoke(
      NOTES_IPC_CHANNELS.rename,
      relativePath,
      requestedTitle
    ) as Promise<RenameNoteResult>,
  deleteNote: (relativePath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.delete, relativePath) as Promise<DeleteNoteResult>,
  archiveNote: (relativePath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.archive, relativePath) as Promise<ArchiveNoteResult>,
  moveNote: (fromPath: string, toPath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.move, fromPath, toPath) as Promise<MoveNoteResult>,
  createFolder: (relativePath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.createFolder, relativePath) as Promise<CreateFolderResult>,
  renameFolder: (fromPath: string, toPath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.renameFolder, fromPath, toPath) as Promise<RenameFolderResult>
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('windowControls', windowControls)
    contextBridge.exposeInMainWorld('shortcuts', shortcuts)
    contextBridge.exposeInMainWorld('notes', notes)
    contextBridge.exposeInMainWorld('ghostMode', ghostMode)
    contextBridge.exposeInMainWorld('contextMenu', contextMenu)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.windowControls = windowControls
  // @ts-ignore (define in dts)
  window.shortcuts = shortcuts
  // @ts-ignore (define in dts)
  window.notes = notes
  // @ts-ignore (define in dts)
  window.ghostMode = ghostMode
  // @ts-ignore (define in dts)
  window.contextMenu = contextMenu
}
