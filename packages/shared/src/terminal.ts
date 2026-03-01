export type TerminalSessionId = string

export type TerminalSurface = 'bottom-panel' | 'editor'

export type TerminalRendererType = 'auto' | 'canvas' | 'dom'
export type TerminalCursorStyle = 'block' | 'underline' | 'bar'
export type TerminalBellStyle = 'none' | 'sound' | 'visual'

export type TerminalSettings = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  cursorStyle: TerminalCursorStyle
  cursorBlink: boolean
  scrollback: number
  rendererType: TerminalRendererType
  bellStyle: TerminalBellStyle
  copyOnSelect: boolean
  shellPath: string | null
  shellArgs: string[]
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
  fontSize: 12,
  lineHeight: 1.2,
  letterSpacing: 0,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  rendererType: 'auto',
  bellStyle: 'none',
  copyOnSelect: false,
  shellPath: null,
  shellArgs: []
}

export type TerminalCreateOptions = {
  name?: string
  cwd?: string | null
  shellPath?: string | null
  shellArgs?: string[]
  env?: Record<string, string>
  cols?: number
  rows?: number
  surface?: TerminalSurface
}

export type TerminalSessionSummary = {
  id: TerminalSessionId
  ownerWindowId: string
  name: string | null
  title: string | null
  cwd: string | null
  shellPath: string
  shellArgs: string[]
  cols: number
  rows: number
  surface: TerminalSurface
  createdAt: number
  updatedAt: number
  exited: boolean
  exitCode: number | null
  signal: number | null
}

export type TerminalSessionMetaPatch = {
  name?: string | null
  title?: string | null
  cwd?: string | null
}

export type TerminalDataEvent = {
  sessionId: TerminalSessionId
  data: string
}

export type TerminalExitEvent = {
  sessionId: TerminalSessionId
  exitCode: number | null
  signal: number | null
}

export type TerminalTitleEvent = {
  sessionId: TerminalSessionId
  title: string
}

export type TerminalBellEvent = {
  sessionId: TerminalSessionId
}

export type TerminalSessionChangedEvent = {
  sessionId: TerminalSessionId
  change: 'created' | 'updated' | 'removed'
  session: TerminalSessionSummary | null
}

export const TERMINAL_IPC_CHANNELS = {
  createSession: 'terminal:create-session',
  listSessions: 'terminal:list-sessions',
  write: 'terminal:write',
  resize: 'terminal:resize',
  kill: 'terminal:kill',
  clearBuffer: 'terminal:clear-buffer',
  readBuffer: 'terminal:read-buffer',
  updateSessionMeta: 'terminal:update-session-meta',
  getSettings: 'terminal:get-settings',
  updateSettings: 'terminal:update-settings'
} as const

export const TERMINAL_EVENT_CHANNELS = {
  data: 'terminal:event-data',
  exit: 'terminal:event-exit',
  title: 'terminal:event-title',
  bell: 'terminal:event-bell',
  sessionChanged: 'terminal:event-session-changed'
} as const
