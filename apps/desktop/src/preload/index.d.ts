import { ElectronAPI } from '@electron-toolkit/preload'
import {
  type ShortcutActionId,
  type ShortcutProfile,
  type ShortcutRuleImport,
  type ShortcutRulePatch,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'
import type {
  ArchiveNoteResult,
  CreateFolderResult,
  CreateNoteInput,
  DeleteFolderResult,
  DeleteNoteResult,
  MoveNoteResult,
  NoteDocument,
  NotesConfig,
  NoteSummary,
  OpenBufferSnapshot,
  RenameFolderResult,
  RenameNoteResult,
  SearchQueryOptions,
  SaveNoteAsResult,
  SaveNoteResult,
  SearchContentMatch
} from '@onpoint/shared/notes'
import type {
  TerminalBellEvent,
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSessionChangedEvent,
  TerminalSessionId,
  TerminalSessionMetaPatch,
  TerminalSessionSummary,
  TerminalSettings,
  TerminalTitleEvent
} from '@onpoint/shared/terminal'
import type {
  AgentArchiveInput,
  AgentAnswerClarificationInput,
  AgentCreateInput,
  AgentDeleteInput,
  AgentRecord,
  AgentSetStatusInput,
  AgentUpdatePlanInput
} from '@onpoint/shared/agents'

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
  list: () => Promise<ShortcutProfile>
  update: (actionId: ShortcutActionId, patch: ShortcutRulePatch) => Promise<ShortcutUpdateResult>
  reset: (actionId: ShortcutActionId) => Promise<void>
  resetAll: () => Promise<void>
  replaceAll: (rules: ShortcutRuleImport[]) => Promise<ShortcutUpdateResult>
  execute: (actionId: ShortcutActionId) => Promise<void>
  onGlobalAction: (callback: (actionId: ShortcutActionId) => void) => () => void
  onBindingsChanged: (callback: (profile: ShortcutProfile) => void) => () => void
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
  deleteFolder: (relativePath: string) => Promise<DeleteFolderResult>
  archiveNote: (relativePath: string) => Promise<ArchiveNoteResult>
  moveNote: (fromPath: string, toPath: string) => Promise<MoveNoteResult>
  createFolder: (relativePath: string) => Promise<CreateFolderResult>
  renameFolder: (fromPath: string, toPath: string) => Promise<RenameFolderResult>
  searchContent: (query: string) => Promise<SearchContentMatch[]>
  searchContentV2: (
    query: string,
    options?: SearchQueryOptions,
    openBuffers?: OpenBufferSnapshot[]
  ) => Promise<SearchContentMatch[]>
  listFolders: () => Promise<string[]>
}

type TerminalsAPI = {
  createSession: (options?: TerminalCreateOptions) => Promise<TerminalSessionSummary>
  listSessions: () => Promise<TerminalSessionSummary[]>
  write: (sessionId: TerminalSessionId, data: string) => Promise<void>
  resize: (sessionId: TerminalSessionId, cols: number, rows: number) => Promise<void>
  kill: (sessionId: TerminalSessionId) => Promise<void>
  clearBuffer: (sessionId: TerminalSessionId) => Promise<void>
  readBuffer: (sessionId: TerminalSessionId) => Promise<string>
  updateSessionMeta: (
    sessionId: TerminalSessionId,
    patch: TerminalSessionMetaPatch
  ) => Promise<TerminalSessionSummary>
  getSettings: () => Promise<TerminalSettings>
  updateSettings: (patch: Partial<TerminalSettings>) => Promise<TerminalSettings>
  onData: (callback: (event: TerminalDataEvent) => void) => () => void
  onExit: (callback: (event: TerminalExitEvent) => void) => () => void
  onTitle: (callback: (event: TerminalTitleEvent) => void) => () => void
  onBell: (callback: (event: TerminalBellEvent) => void) => () => void
  onSessionChanged: (callback: (event: TerminalSessionChangedEvent) => void) => () => void
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

type AgentsAPI = {
  list: () => Promise<AgentRecord[]>
  create: (input?: AgentCreateInput) => Promise<AgentRecord>
  updatePlan: (input: AgentUpdatePlanInput) => Promise<AgentRecord>
  setStatus: (input: AgentSetStatusInput) => Promise<AgentRecord>
  answerClarification: (input: AgentAnswerClarificationInput) => Promise<AgentRecord>
  archive: (input: AgentArchiveInput) => Promise<AgentRecord>
  delete: (input: AgentDeleteInput) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    windowControls: WindowControlsAPI
    shortcuts: ShortcutsAPI
    notes: NotesAPI
    terminals: TerminalsAPI
    ghostMode: GhostModeAPI
    contextMenu: ContextMenuAPI
    menuEvents: MenuEventsAPI
    agents: AgentsAPI
  }
}
