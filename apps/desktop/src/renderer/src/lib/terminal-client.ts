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

const terminalClient = {
  createSession: (options?: TerminalCreateOptions): Promise<TerminalSessionSummary> =>
    window.terminals.createSession(options),
  listSessions: (): Promise<TerminalSessionSummary[]> => window.terminals.listSessions(),
  write: (sessionId: TerminalSessionId, data: string): Promise<void> =>
    window.terminals.write(sessionId, data),
  resize: (sessionId: TerminalSessionId, cols: number, rows: number): Promise<void> =>
    window.terminals.resize(sessionId, cols, rows),
  kill: (sessionId: TerminalSessionId): Promise<void> => window.terminals.kill(sessionId),
  clearBuffer: (sessionId: TerminalSessionId): Promise<void> =>
    window.terminals.clearBuffer(sessionId),
  readBuffer: (sessionId: TerminalSessionId): Promise<string> =>
    window.terminals.readBuffer(sessionId),
  updateSessionMeta: (
    sessionId: TerminalSessionId,
    patch: TerminalSessionMetaPatch
  ): Promise<TerminalSessionSummary> => window.terminals.updateSessionMeta(sessionId, patch),
  getSettings: (): Promise<TerminalSettings> => window.terminals.getSettings(),
  updateSettings: (patch: Partial<TerminalSettings>): Promise<TerminalSettings> =>
    window.terminals.updateSettings(patch),
  onData: (callback: (event: TerminalDataEvent) => void): (() => void) =>
    window.terminals.onData(callback),
  onExit: (callback: (event: TerminalExitEvent) => void): (() => void) =>
    window.terminals.onExit(callback),
  onTitle: (callback: (event: TerminalTitleEvent) => void): (() => void) =>
    window.terminals.onTitle(callback),
  onBell: (callback: (event: TerminalBellEvent) => void): (() => void) =>
    window.terminals.onBell(callback),
  onSessionChanged: (callback: (event: TerminalSessionChangedEvent) => void): (() => void) =>
    window.terminals.onSessionChanged(callback)
}

export { terminalClient }
