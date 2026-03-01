import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { promises as fs } from 'node:fs'
import { spawn as spawnProcess } from 'node:child_process'
import { app, type BrowserWindow } from 'electron'
import { spawn as spawnPty, type IPty } from 'node-pty'
import {
  TERMINAL_EVENT_CHANNELS,
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
import { loadNotesConfig } from '../notes/store'
import { loadTerminalSettings, mergeTerminalSettings, saveTerminalSettings } from './store'

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24
const MAX_WRITE_CHUNK_SIZE = 64 * 1024
const MAX_BUFFER_BYTES = 2 * 1024 * 1024
const SHELL_ENV_TIMEOUT_MS = 1500
const MAX_SHELL_ENV_CAPTURE_BYTES = 1024 * 1024

type TerminalServiceOptions = {
  getWindowById: (windowId: string) => BrowserWindow | undefined
}

type SessionState = {
  sessionId: TerminalSessionId
  pty: IPty
  summary: TerminalSessionSummary
  bufferChunks: string[]
  bufferBytes: number
  maxBufferBytes: number
}

let resolvedShellEnvPromise: Promise<Record<string, string> | null> | null = null

function sanitizeString(value: unknown, maxLength = 4096): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, maxLength)
}

function sanitizeShellArgs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 32)
}

function sanitizeEnv(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}

  const output: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (typeof raw !== 'string') continue
    output[key] = raw.slice(0, 8192)
  }
  return output
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function hasBellCharacter(chunk: string): boolean {
  return chunk.includes('\u0007')
}

function parseNullDelimitedEnv(raw: string): Record<string, string> {
  const output: Record<string, string> = {}
  for (const entry of raw.split('\u0000')) {
    if (!entry) continue
    const separatorIndex = entry.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = entry.slice(0, separatorIndex)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    output[key] = entry.slice(separatorIndex + 1)
  }
  return output
}

async function resolveLoginShellEnv(): Promise<Record<string, string> | null> {
  if (process.platform === 'win32') return null
  const loginShell = process.env.SHELL
  if (!loginShell) return null

  return new Promise((resolve) => {
    let settled = false
    let stdout = ''
    const child = spawnProcess(loginShell, ['-l', '-c', 'env -0'], {
      env: { ...process.env, TERM: 'dumb' },
      stdio: ['ignore', 'pipe', 'ignore']
    })

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      resolve(null)
    }, SHELL_ENV_TIMEOUT_MS)

    child.stdout?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => {
      if (settled) return
      stdout += chunk
      if (stdout.length > MAX_SHELL_ENV_CAPTURE_BYTES) {
        stdout = stdout.slice(-MAX_SHELL_ENV_CAPTURE_BYTES)
      }
    })

    child.on('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(null)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code !== 0) {
        resolve(null)
        return
      }
      const parsed = parseNullDelimitedEnv(stdout)
      resolve(Object.keys(parsed).length > 0 ? parsed : null)
    })
  })
}

async function resolveBaseProcessEnv(): Promise<NodeJS.ProcessEnv> {
  if (process.platform === 'win32') return process.env
  if (!resolvedShellEnvPromise) {
    resolvedShellEnvPromise = resolveLoginShellEnv()
  }
  const shellEnv = await resolvedShellEnvPromise
  if (!shellEnv) return process.env
  return { ...process.env, ...shellEnv }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

function getDefaultShellPath(settings: TerminalSettings): string {
  if (settings.shellPath) return settings.shellPath

  if (process.platform === 'win32') {
    return process.env.ComSpec || 'powershell.exe'
  }

  return process.env.SHELL || '/bin/bash'
}

function getDefaultShellArgs(settings: TerminalSettings): string[] {
  return settings.shellArgs.length > 0 ? settings.shellArgs : []
}

export type TerminalService = {
  createSession: (
    windowId: string,
    optionsInput?: TerminalCreateOptions
  ) => Promise<TerminalSessionSummary>
  listSessions: (windowId: string) => TerminalSessionSummary[]
  write: (windowId: string, sessionId: TerminalSessionId, data: string) => void
  resize: (windowId: string, sessionId: TerminalSessionId, cols: number, rows: number) => void
  kill: (windowId: string, sessionId: TerminalSessionId) => void
  clearBuffer: (windowId: string, sessionId: TerminalSessionId) => void
  readBuffer: (windowId: string, sessionId: TerminalSessionId) => string
  updateSessionMeta: (
    windowId: string,
    sessionId: TerminalSessionId,
    patchInput: TerminalSessionMetaPatch
  ) => TerminalSessionSummary
  getSettings: (windowId: string) => Promise<TerminalSettings>
  updateSettings: (windowId: string, patch: Partial<TerminalSettings>) => Promise<TerminalSettings>
  handleWindowClosed: (windowId: string) => void
  dispose: () => void
}

export function createTerminalService(options: TerminalServiceOptions): TerminalService {
  const sessions = new Map<TerminalSessionId, SessionState>()

  function emit(ownerWindowId: string, channel: string, payload: unknown): void {
    const window = options.getWindowById(ownerWindowId)
    if (!window || window.isDestroyed()) return
    window.webContents.send(channel, payload)
  }

  function emitSessionChanged(
    ownerWindowId: string,
    sessionId: TerminalSessionId,
    change: TerminalSessionChangedEvent['change'],
    summary: TerminalSessionSummary | null
  ): void {
    const payload: TerminalSessionChangedEvent = {
      sessionId,
      change,
      session: summary
    }
    emit(ownerWindowId, TERMINAL_EVENT_CHANNELS.sessionChanged, payload)
  }

  function appendChunk(state: SessionState, chunk: string): void {
    if (!chunk) return

    const bytes = Buffer.byteLength(chunk, 'utf-8')
    state.bufferChunks.push(chunk)
    state.bufferBytes += bytes

    while (state.bufferBytes > state.maxBufferBytes && state.bufferChunks.length > 0) {
      const removed = state.bufferChunks.shift()
      if (!removed) continue
      state.bufferBytes -= Buffer.byteLength(removed, 'utf-8')
    }
  }

  function getSessionOwnedBy(sessionId: TerminalSessionId, windowId: string): SessionState {
    const state = sessions.get(sessionId)
    if (!state) {
      throw new Error('Terminal session not found.')
    }
    if (state.summary.ownerWindowId !== windowId) {
      throw new Error('Access denied for terminal session.')
    }
    return state
  }

  async function resolveDefaultCwd(windowId: string): Promise<string> {
    const config = await loadNotesConfig(windowId)
    if (config.vaultPath && (await isDirectory(config.vaultPath))) {
      return config.vaultPath
    }

    return homedir()
  }

  function resolveSessionSummary(state: SessionState): TerminalSessionSummary {
    return { ...state.summary, shellArgs: [...state.summary.shellArgs] }
  }

  function listSessions(windowId: string): TerminalSessionSummary[] {
    const summaries: TerminalSessionSummary[] = []
    for (const state of sessions.values()) {
      if (state.summary.ownerWindowId !== windowId) continue
      summaries.push(resolveSessionSummary(state))
    }
    return summaries.sort((a, b) => a.createdAt - b.createdAt)
  }

  async function createSession(
    windowId: string,
    optionsInput?: TerminalCreateOptions
  ): Promise<TerminalSessionSummary> {
    const options = optionsInput ?? {}
    const settings = await loadTerminalSettings(windowId)

    const shellPath = sanitizeString(options.shellPath) ?? getDefaultShellPath(settings)
    const shellArgs =
      options.shellArgs && options.shellArgs.length > 0
        ? sanitizeShellArgs(options.shellArgs)
        : getDefaultShellArgs(settings)

    const fallbackCwd = await resolveDefaultCwd(windowId)
    const preferredCwd = sanitizeString(options.cwd ?? null)
    const cwd = preferredCwd && (await isDirectory(preferredCwd)) ? preferredCwd : fallbackCwd

    const cols = clampInt(options.cols, DEFAULT_COLS, 20, 400)
    const rows = clampInt(options.rows, DEFAULT_ROWS, 5, 200)
    const baseEnv = await resolveBaseProcessEnv()
    const env = {
      ...baseEnv,
      ...sanitizeEnv(options.env),
      TERM_PROGRAM: 'Onpoint',
      TERM_PROGRAM_VERSION: appVersion()
    }

    const now = Date.now()
    const sessionId = randomUUID()
    const surface = options.surface === 'editor' ? 'editor' : 'bottom-panel'
    const name = sanitizeString(options.name, 200)

    const pty = spawnPty(shellPath, shellArgs, {
      name: process.platform === 'win32' ? 'xterm-color' : 'xterm-256color',
      cols,
      rows,
      cwd,
      env
    })

    const summary: TerminalSessionSummary = {
      id: sessionId,
      ownerWindowId: windowId,
      name,
      title: name,
      cwd,
      shellPath,
      shellArgs,
      cols,
      rows,
      surface,
      createdAt: now,
      updatedAt: now,
      exited: false,
      exitCode: null,
      signal: null
    }

    const state: SessionState = {
      sessionId,
      pty,
      summary,
      bufferChunks: [],
      bufferBytes: 0,
      maxBufferBytes: MAX_BUFFER_BYTES
    }

    pty.onData((data) => {
      appendChunk(state, data)
      state.summary.updatedAt = Date.now()
      const payload: TerminalDataEvent = { sessionId, data }
      emit(windowId, TERMINAL_EVENT_CHANNELS.data, payload)

      if (hasBellCharacter(data)) {
        emit(windowId, TERMINAL_EVENT_CHANNELS.bell, { sessionId })
      }
    })

    pty.onExit(({ exitCode, signal }) => {
      state.summary.exited = true
      state.summary.exitCode = typeof exitCode === 'number' ? exitCode : null
      state.summary.signal = typeof signal === 'number' ? signal : null
      state.summary.updatedAt = Date.now()

      const payload: TerminalExitEvent = {
        sessionId,
        exitCode: state.summary.exitCode,
        signal: state.summary.signal
      }

      emit(windowId, TERMINAL_EVENT_CHANNELS.exit, payload)
      emitSessionChanged(windowId, sessionId, 'updated', resolveSessionSummary(state))
    })

    sessions.set(sessionId, state)
    emitSessionChanged(windowId, sessionId, 'created', resolveSessionSummary(state))

    return resolveSessionSummary(state)
  }

  function write(windowId: string, sessionId: TerminalSessionId, data: string): void {
    const state = getSessionOwnedBy(sessionId, windowId)
    if (state.summary.exited) return

    const normalized = typeof data === 'string' ? data : ''
    if (!normalized) return

    if (Buffer.byteLength(normalized, 'utf-8') > MAX_WRITE_CHUNK_SIZE) {
      throw new Error('Terminal write payload is too large.')
    }

    state.pty.write(normalized)
  }

  function resize(
    windowId: string,
    sessionId: TerminalSessionId,
    cols: number,
    rows: number
  ): void {
    const state = getSessionOwnedBy(sessionId, windowId)

    const nextCols = clampInt(cols, state.summary.cols, 20, 400)
    const nextRows = clampInt(rows, state.summary.rows, 5, 200)
    state.summary.cols = nextCols
    state.summary.rows = nextRows
    state.summary.updatedAt = Date.now()

    if (!state.summary.exited) {
      state.pty.resize(nextCols, nextRows)
    }

    emitSessionChanged(windowId, sessionId, 'updated', resolveSessionSummary(state))
  }

  function clearBuffer(windowId: string, sessionId: TerminalSessionId): void {
    const state = getSessionOwnedBy(sessionId, windowId)
    state.bufferChunks = []
    state.bufferBytes = 0
  }

  function readBuffer(windowId: string, sessionId: TerminalSessionId): string {
    const state = getSessionOwnedBy(sessionId, windowId)
    return state.bufferChunks.join('')
  }

  function updateSessionMeta(
    windowId: string,
    sessionId: TerminalSessionId,
    patchInput: TerminalSessionMetaPatch
  ): TerminalSessionSummary {
    const state = getSessionOwnedBy(sessionId, windowId)
    const patch = patchInput ?? {}

    if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
      state.summary.name = sanitizeString(patch.name, 200)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
      state.summary.title = sanitizeString(patch.title, 200)
      const title = state.summary.title
      if (title) {
        const payload: TerminalTitleEvent = { sessionId, title }
        emit(windowId, TERMINAL_EVENT_CHANNELS.title, payload)
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'cwd')) {
      state.summary.cwd = sanitizeString(patch.cwd)
    }

    state.summary.updatedAt = Date.now()
    emitSessionChanged(windowId, sessionId, 'updated', resolveSessionSummary(state))
    return resolveSessionSummary(state)
  }

  function kill(windowId: string, sessionId: TerminalSessionId): void {
    const state = getSessionOwnedBy(sessionId, windowId)
    if (!state.summary.exited) {
      state.pty.kill()
    }
    sessions.delete(sessionId)
    emitSessionChanged(windowId, sessionId, 'removed', null)
  }

  async function getSettings(windowId: string): Promise<TerminalSettings> {
    return loadTerminalSettings(windowId)
  }

  async function updateSettings(
    windowId: string,
    patch: Partial<TerminalSettings>
  ): Promise<TerminalSettings> {
    const existing = await loadTerminalSettings(windowId)
    const next = mergeTerminalSettings(existing, patch)
    await saveTerminalSettings(windowId, next)
    return next
  }

  function handleWindowClosed(windowId: string): void {
    const targetSessionIds: string[] = []
    for (const state of sessions.values()) {
      if (state.summary.ownerWindowId === windowId) {
        targetSessionIds.push(state.sessionId)
      }
    }

    for (const sessionId of targetSessionIds) {
      const state = sessions.get(sessionId)
      if (!state) continue
      try {
        if (!state.summary.exited) {
          state.pty.kill()
        }
      } catch {
        // ignore
      }
      sessions.delete(sessionId)
    }
  }

  function dispose(): void {
    const allIds = Array.from(sessions.keys())
    for (const sessionId of allIds) {
      const state = sessions.get(sessionId)
      if (!state) continue
      try {
        if (!state.summary.exited) {
          state.pty.kill()
        }
      } catch {
        // ignore
      }
      sessions.delete(sessionId)
    }
  }

  return {
    createSession,
    listSessions,
    write,
    resize,
    kill,
    clearBuffer,
    readBuffer,
    updateSessionMeta,
    getSettings,
    updateSettings,
    handleWindowClosed,
    dispose
  }
}

function appVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return 'dev'
  }
}
