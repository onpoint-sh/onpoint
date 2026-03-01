import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  SHORTCUT_IPC_CHANNELS,
  type ShortcutActionId,
  type ShortcutProfile,
  type ShortcutRuleImport,
  type ShortcutRulePatch,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'
import {
  NOTES_IPC_CHANNELS,
  type ArchiveNoteResult,
  type CreateFolderResult,
  type CreateNoteInput,
  type DeleteFolderResult,
  type DeleteNoteResult,
  type MoveNoteResult,
  type NoteDocument,
  type NotesConfig,
  type RenameFolderResult,
  type RenameNoteResult,
  type NoteSummary,
  type OpenBufferSnapshot,
  type SearchQueryOptions,
  type SaveNoteAsResult,
  type SaveNoteResult,
  type SearchContentMatch
} from '@onpoint/shared/notes'
import { GHOST_MODE_IPC_CHANNELS, type GhostModeConfig } from '@onpoint/shared/ghost-mode'
import { WINDOW_IPC_CHANNELS } from '@onpoint/shared/window'
import {
  TERMINAL_EVENT_CHANNELS,
  TERMINAL_IPC_CHANNELS,
  type TerminalBellEvent,
  type TerminalCreateOptions,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalSessionChangedEvent,
  type TerminalSessionId,
  type TerminalSessionMetaPatch,
  type TerminalSessionSummary,
  type TerminalSettings,
  type TerminalTitleEvent
} from '@onpoint/shared/terminal'
import {
  AGENTS_IPC_CHANNELS,
  type AgentArchiveInput,
  type AgentAnswerClarificationInput,
  type AgentCreateInput,
  type AgentDeleteInput,
  type AgentRecord,
  type AgentSetStatusInput,
  type AgentUpdatePlanInput
} from '@onpoint/shared/agents'

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
  fullScreenChanged: 'window-controls:full-screen-changed',
  zoomFactorChanged: 'window-controls:zoom-factor-changed'
} as const

const windowControls = {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke(IPC_CHANNELS.minimize),
  toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.toggleMaximize) as Promise<boolean>,
  close: () => ipcRenderer.invoke(IPC_CHANNELS.close),
  isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.isMaximized) as Promise<boolean>,
  isFullScreen: () => ipcRenderer.invoke('window-controls:is-full-screen') as Promise<boolean>,
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
  onFullScreenChanged: (callback: (isFullScreen: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, isFullScreen: boolean): void => {
      callback(isFullScreen)
    }

    ipcRenderer.on(IPC_CHANNELS.fullScreenChanged, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.fullScreenChanged, listener)
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
  detachTab: (relativePath: string, force?: boolean) =>
    ipcRenderer.invoke(WINDOW_IPC_CHANNELS.detachTab, relativePath, force) as Promise<boolean>,
  getDetachInit: () =>
    ipcRenderer.invoke(WINDOW_IPC_CHANNELS.getDetachInit) as Promise<{
      relativePath: string
    } | null>,
  newWindow: () => ipcRenderer.invoke(WINDOW_IPC_CHANNELS.newWindow) as Promise<void>,
  getWindowId: () => ipcRenderer.invoke(WINDOW_IPC_CHANNELS.getWindowId) as Promise<string | null>
}

const shortcuts = {
  list: () => ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.list) as Promise<ShortcutProfile>,
  update: (actionId: ShortcutActionId, patch: ShortcutRulePatch) =>
    ipcRenderer.invoke(
      SHORTCUT_IPC_CHANNELS.update,
      actionId,
      patch
    ) as Promise<ShortcutUpdateResult>,
  reset: (actionId: ShortcutActionId) =>
    ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.reset, actionId) as Promise<void>,
  resetAll: () => ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.resetAll) as Promise<void>,
  replaceAll: (rules: ShortcutRuleImport[]) =>
    ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.replaceAll, rules) as Promise<ShortcutUpdateResult>,
  execute: (actionId: ShortcutActionId) =>
    ipcRenderer.invoke(SHORTCUT_IPC_CHANNELS.execute, actionId) as Promise<void>,
  onGlobalAction: (callback: (actionId: ShortcutActionId) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, actionId: ShortcutActionId): void => {
      callback(actionId)
    }

    ipcRenderer.on(SHORTCUT_IPC_CHANNELS.globalAction, listener)

    return () => {
      ipcRenderer.removeListener(SHORTCUT_IPC_CHANNELS.globalAction, listener)
    }
  },
  onBindingsChanged: (callback: (profile: ShortcutProfile) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, profile: ShortcutProfile): void => {
      callback(profile)
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

type ContextMenuItem = {
  id: string
  label: string
  separator?: boolean
  accelerator?: string
  submenu?: ContextMenuItem[]
}

const contextMenu = {
  show: (items: ContextMenuItem[]) =>
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
    ipcRenderer.invoke(
      NOTES_IPC_CHANNELS.create,
      input,
      parentRelativePath
    ) as Promise<NoteDocument>,
  saveNote: (relativePath: string, content: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.save, relativePath, content) as Promise<SaveNoteResult>,
  saveNoteAs: (content: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.saveAs, content) as Promise<SaveNoteAsResult | null>,
  renameNote: (relativePath: string, requestedTitle: string) =>
    ipcRenderer.invoke(
      NOTES_IPC_CHANNELS.rename,
      relativePath,
      requestedTitle
    ) as Promise<RenameNoteResult>,
  deleteNote: (relativePath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.delete, relativePath) as Promise<DeleteNoteResult>,
  deleteFolder: (relativePath: string) =>
    ipcRenderer.invoke(
      NOTES_IPC_CHANNELS.deleteFolder,
      relativePath
    ) as Promise<DeleteFolderResult>,
  archiveNote: (relativePath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.archive, relativePath) as Promise<ArchiveNoteResult>,
  moveNote: (fromPath: string, toPath: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.move, fromPath, toPath) as Promise<MoveNoteResult>,
  createFolder: (relativePath: string) =>
    ipcRenderer.invoke(
      NOTES_IPC_CHANNELS.createFolder,
      relativePath
    ) as Promise<CreateFolderResult>,
  renameFolder: (fromPath: string, toPath: string) =>
    ipcRenderer.invoke(
      NOTES_IPC_CHANNELS.renameFolder,
      fromPath,
      toPath
    ) as Promise<RenameFolderResult>,
  searchContent: (query: string) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.searchContent, query) as Promise<SearchContentMatch[]>,
  searchContentV2: (
    query: string,
    options?: SearchQueryOptions,
    openBuffers?: OpenBufferSnapshot[]
  ) =>
    ipcRenderer.invoke(NOTES_IPC_CHANNELS.searchContentV2, query, options, openBuffers) as Promise<
      SearchContentMatch[]
    >,
  listFolders: () => ipcRenderer.invoke(NOTES_IPC_CHANNELS.listFolders) as Promise<string[]>
}

const terminals = {
  createSession: (options?: TerminalCreateOptions) =>
    ipcRenderer.invoke(
      TERMINAL_IPC_CHANNELS.createSession,
      options
    ) as Promise<TerminalSessionSummary>,
  listSessions: () =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.listSessions) as Promise<TerminalSessionSummary[]>,
  write: (sessionId: TerminalSessionId, data: string) =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.write, sessionId, data) as Promise<void>,
  resize: (sessionId: TerminalSessionId, cols: number, rows: number) =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.resize, sessionId, cols, rows) as Promise<void>,
  kill: (sessionId: TerminalSessionId) =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.kill, sessionId) as Promise<void>,
  clearBuffer: (sessionId: TerminalSessionId) =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.clearBuffer, sessionId) as Promise<void>,
  readBuffer: (sessionId: TerminalSessionId) =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.readBuffer, sessionId) as Promise<string>,
  updateSessionMeta: (sessionId: TerminalSessionId, patch: TerminalSessionMetaPatch) =>
    ipcRenderer.invoke(
      TERMINAL_IPC_CHANNELS.updateSessionMeta,
      sessionId,
      patch
    ) as Promise<TerminalSessionSummary>,
  getSettings: () =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.getSettings) as Promise<TerminalSettings>,
  updateSettings: (patch: Partial<TerminalSettings>) =>
    ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.updateSettings, patch) as Promise<TerminalSettings>,
  onData: (callback: (event: TerminalDataEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalDataEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(TERMINAL_EVENT_CHANNELS.data, listener)
    return () => {
      ipcRenderer.removeListener(TERMINAL_EVENT_CHANNELS.data, listener)
    }
  },
  onExit: (callback: (event: TerminalExitEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalExitEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(TERMINAL_EVENT_CHANNELS.exit, listener)
    return () => {
      ipcRenderer.removeListener(TERMINAL_EVENT_CHANNELS.exit, listener)
    }
  },
  onTitle: (callback: (event: TerminalTitleEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalTitleEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(TERMINAL_EVENT_CHANNELS.title, listener)
    return () => {
      ipcRenderer.removeListener(TERMINAL_EVENT_CHANNELS.title, listener)
    }
  },
  onBell: (callback: (event: TerminalBellEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalBellEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(TERMINAL_EVENT_CHANNELS.bell, listener)
    return () => {
      ipcRenderer.removeListener(TERMINAL_EVENT_CHANNELS.bell, listener)
    }
  },
  onSessionChanged: (callback: (event: TerminalSessionChangedEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalSessionChangedEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(TERMINAL_EVENT_CHANNELS.sessionChanged, listener)
    return () => {
      ipcRenderer.removeListener(TERMINAL_EVENT_CHANNELS.sessionChanged, listener)
    }
  }
}

const menuEvents = {
  onTriggerPickVault: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }

    ipcRenderer.on('menu:trigger-pick-vault', listener)

    return () => {
      ipcRenderer.removeListener('menu:trigger-pick-vault', listener)
    }
  },
  onTriggerCreateNote: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }

    ipcRenderer.on('menu:trigger-create-note', listener)

    return () => {
      ipcRenderer.removeListener('menu:trigger-create-note', listener)
    }
  }
}

const agents = {
  list: () => ipcRenderer.invoke(AGENTS_IPC_CHANNELS.list) as Promise<AgentRecord[]>,
  create: (input?: AgentCreateInput) =>
    ipcRenderer.invoke(AGENTS_IPC_CHANNELS.create, input) as Promise<AgentRecord>,
  updatePlan: (input: AgentUpdatePlanInput) =>
    ipcRenderer.invoke(AGENTS_IPC_CHANNELS.updatePlan, input) as Promise<AgentRecord>,
  setStatus: (input: AgentSetStatusInput) =>
    ipcRenderer.invoke(AGENTS_IPC_CHANNELS.setStatus, input) as Promise<AgentRecord>,
  answerClarification: (input: AgentAnswerClarificationInput) =>
    ipcRenderer.invoke(AGENTS_IPC_CHANNELS.answerClarification, input) as Promise<AgentRecord>,
  archive: (input: AgentArchiveInput) =>
    ipcRenderer.invoke(AGENTS_IPC_CHANNELS.archive, input) as Promise<AgentRecord>,
  delete: (input: AgentDeleteInput) =>
    ipcRenderer.invoke(AGENTS_IPC_CHANNELS.delete, input) as Promise<void>
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('windowControls', windowControls)
  contextBridge.exposeInMainWorld('shortcuts', shortcuts)
  contextBridge.exposeInMainWorld('notes', notes)
  contextBridge.exposeInMainWorld('terminals', terminals)
  contextBridge.exposeInMainWorld('ghostMode', ghostMode)
  contextBridge.exposeInMainWorld('contextMenu', contextMenu)
  contextBridge.exposeInMainWorld('menuEvents', menuEvents)
  contextBridge.exposeInMainWorld('agents', agents)
} catch (error) {
  console.error(error)
}
