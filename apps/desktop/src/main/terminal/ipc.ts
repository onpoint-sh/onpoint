import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  TERMINAL_IPC_CHANNELS,
  type TerminalCreateOptions,
  type TerminalSessionId,
  type TerminalSessionMetaPatch,
  type TerminalSettings
} from '@onpoint/shared/terminal'
import { windowRegistry } from '../window/window-registry'
import type { TerminalService } from './service'

function resolveWindowId(event: IpcMainInvokeEvent): string {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return 'main'
  return windowRegistry.getWindowId(window) ?? 'main'
}

function validateSessionId(value: unknown): TerminalSessionId {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Invalid terminal session id.')
  }
  return value
}

function validatePayloadSize(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`)
  }
  if (value.length === 0) return value
  if (value.length > 1024 * 1024) {
    throw new Error(`${label} is too large.`)
  }
  return value
}

function removeTerminalHandlers(): void {
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.createSession)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.listSessions)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.write)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.resize)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.kill)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.clearBuffer)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.readBuffer)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.updateSessionMeta)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.getSettings)
  ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.updateSettings)
}

export function registerTerminalIpc(service: TerminalService): () => void {
  removeTerminalHandlers()

  ipcMain.handle(TERMINAL_IPC_CHANNELS.createSession, (event, options?: TerminalCreateOptions) => {
    return service.createSession(resolveWindowId(event), options)
  })

  ipcMain.handle(TERMINAL_IPC_CHANNELS.listSessions, (event) => {
    return service.listSessions(resolveWindowId(event))
  })

  ipcMain.handle(
    TERMINAL_IPC_CHANNELS.write,
    (event, sessionId: TerminalSessionId, data: string) => {
      service.write(
        resolveWindowId(event),
        validateSessionId(sessionId),
        validatePayloadSize(data, 'Data')
      )
    }
  )

  ipcMain.handle(
    TERMINAL_IPC_CHANNELS.resize,
    (event, sessionId: TerminalSessionId, cols: number, rows: number) => {
      service.resize(resolveWindowId(event), validateSessionId(sessionId), cols, rows)
    }
  )

  ipcMain.handle(TERMINAL_IPC_CHANNELS.kill, (event, sessionId: TerminalSessionId) => {
    service.kill(resolveWindowId(event), validateSessionId(sessionId))
  })

  ipcMain.handle(TERMINAL_IPC_CHANNELS.clearBuffer, (event, sessionId: TerminalSessionId) => {
    service.clearBuffer(resolveWindowId(event), validateSessionId(sessionId))
  })

  ipcMain.handle(TERMINAL_IPC_CHANNELS.readBuffer, (event, sessionId: TerminalSessionId) => {
    return service.readBuffer(resolveWindowId(event), validateSessionId(sessionId))
  })

  ipcMain.handle(
    TERMINAL_IPC_CHANNELS.updateSessionMeta,
    (event, sessionId: TerminalSessionId, patch?: TerminalSessionMetaPatch) => {
      return service.updateSessionMeta(
        resolveWindowId(event),
        validateSessionId(sessionId),
        patch ?? {}
      )
    }
  )

  ipcMain.handle(TERMINAL_IPC_CHANNELS.getSettings, (event) => {
    return service.getSettings(resolveWindowId(event))
  })

  ipcMain.handle(
    TERMINAL_IPC_CHANNELS.updateSettings,
    (event, patch: Partial<TerminalSettings> | undefined) => {
      return service.updateSettings(resolveWindowId(event), patch ?? {})
    }
  )

  return () => {
    removeTerminalHandlers()
  }
}
