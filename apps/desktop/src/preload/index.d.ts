import { ElectronAPI } from '@electron-toolkit/preload'
import {
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'
import type {
  ArchiveNoteResult,
  CreateFolderResult,
  CreateNoteInput,
  DeleteNoteResult,
  MoveNoteResult,
  NoteDocument,
  NotesConfig,
  NoteSummary,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteAsResult,
  SaveNoteResult,
  SearchContentMatch
} from '@onpoint/shared/notes'

type WindowControlsAPI = {
  platform: NodeJS.Platform
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  isFullScreen: () => Promise<boolean>
  zoomIn: () => Promise<void>
  zoomOut: () => Promise<void>
  resetZoom: () => Promise<void>
  getZoomFactor: () => Promise<number>
  onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void
  onFullScreenChanged: (callback: (isFullScreen: boolean) => void) => () => void
  onZoomFactorChanged: (callback: (zoomFactor: number) => void) => () => void
  detachTab: (relativePath: string, force?: boolean) => Promise<boolean>
  getDetachInit: () => Promise<{ relativePath: string } | null>
  newWindow: () => Promise<void>
  getWindowId: () => Promise<string | null>
}

type ShortcutsAPI = {
  list: () => Promise<ShortcutBindings>
  update: (actionId: ShortcutActionId, accelerator: string) => Promise<ShortcutUpdateResult>
  reset: (actionId: ShortcutActionId) => Promise<void>
  resetAll: () => Promise<void>
  onGlobalAction: (callback: (actionId: ShortcutActionId) => void) => () => void
  onBindingsChanged: (callback: (bindings: ShortcutBindings) => void) => () => void
}

type GhostModeConfig = {
  opacity: number
}

type GhostModeAPI = {
  getState: () => Promise<boolean>
  getConfig: () => Promise<GhostModeConfig>
  setOpacity: (value: number) => Promise<GhostModeConfig>
  onStateChanged: (callback: (isActive: boolean) => void) => () => void
}

type NotesAPI = {
  getConfig: () => Promise<NotesConfig>
  pickVault: () => Promise<string | null>
  setVault: (vaultPath: string) => Promise<NotesConfig>
  listNotes: () => Promise<NoteSummary[]>
  openNote: (relativePath: string) => Promise<NoteDocument>
  createNote: (input?: CreateNoteInput, parentRelativePath?: string) => Promise<NoteDocument>
  saveNote: (relativePath: string, content: string) => Promise<SaveNoteResult>
  saveNoteAs: (content: string) => Promise<SaveNoteAsResult | null>
  renameNote: (relativePath: string, requestedTitle: string) => Promise<RenameNoteResult>
  deleteNote: (relativePath: string) => Promise<DeleteNoteResult>
  archiveNote: (relativePath: string) => Promise<ArchiveNoteResult>
  moveNote: (fromPath: string, toPath: string) => Promise<MoveNoteResult>
  createFolder: (relativePath: string) => Promise<CreateFolderResult>
  renameFolder: (fromPath: string, toPath: string) => Promise<RenameFolderResult>
  searchContent: (query: string) => Promise<SearchContentMatch[]>
  listFolders: () => Promise<string[]>
}

type ContextMenuItem = {
  id: string
  label: string
  separator?: boolean
  accelerator?: string
  submenu?: ContextMenuItem[]
}

type ContextMenuAPI = {
  show: (items: ContextMenuItem[]) => Promise<string | null>
  revealInFinder: (absolutePath: string) => Promise<void>
}

type MenuEventsAPI = {
  onTriggerPickVault: (callback: () => void) => () => void
  onTriggerCreateNote: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    windowControls: WindowControlsAPI
    shortcuts: ShortcutsAPI
    notes: NotesAPI
    ghostMode: GhostModeAPI
    contextMenu: ContextMenuAPI
    menuEvents: MenuEventsAPI
  }
}
