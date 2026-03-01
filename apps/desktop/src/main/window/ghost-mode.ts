import { app, Menu, type BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import {
  GHOST_MODE_IPC_CHANNELS,
  DEFAULT_GHOST_MODE_CONFIG,
  GHOST_MODE_OPACITY_MIN,
  GHOST_MODE_OPACITY_MAX,
  type GhostModeConfig
} from '@onpoint/shared/ghost-mode'

type GhostModeServiceOptions = {
  getWindows: () => BrowserWindow[]
  onRestoreMenu: () => void
}

type GhostModeService = {
  initialize: () => Promise<void>
  toggle: () => void
  isActive: () => boolean
  applyToWindow: (window: BrowserWindow) => void
  dispose: () => void
}

type StoredGhostModeConfig = {
  version: 1
  opacity: number
}

const CONFIG_FILE_NAME = 'ghost-mode.v1.json'

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME)
}

async function loadConfig(): Promise<GhostModeConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoredGhostModeConfig>

    return {
      opacity: clampOpacity(
        typeof parsed.opacity === 'number' ? parsed.opacity : DEFAULT_GHOST_MODE_CONFIG.opacity
      )
    }
  } catch {
    return { ...DEFAULT_GHOST_MODE_CONFIG }
  }
}

async function saveConfig(config: GhostModeConfig): Promise<void> {
  const stored: StoredGhostModeConfig = { version: 1, opacity: config.opacity }
  const filePath = getConfigPath()
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2), 'utf-8')
}

function clampOpacity(value: number): number {
  return (
    Math.round(Math.max(GHOST_MODE_OPACITY_MIN, Math.min(GHOST_MODE_OPACITY_MAX, value)) * 100) /
    100
  )
}

function createGhostModeService({
  getWindows,
  onRestoreMenu
}: GhostModeServiceOptions): GhostModeService {
  let active = false
  let config: GhostModeConfig = { ...DEFAULT_GHOST_MODE_CONFIG }

  async function initialize(): Promise<void> {
    config = await loadConfig()
  }

  function applyWindowState(window: BrowserWindow, enable: boolean): void {
    if (window.isDestroyed()) return
    window.setContentProtection(enable)
    window.setAlwaysOnTop(enable, enable ? 'screen-saver' : 'normal')
    window.setOpacity(enable ? config.opacity : 1.0)
    window.setVisibleOnAllWorkspaces(enable)
    window.setSkipTaskbar(enable)
    window.setTitle(' ')
  }

  function applyGlobalState(enable: boolean): void {
    // Hide/show dock icon on macOS
    if (app.dock) {
      if (enable) {
        app.dock.hide()
      } else {
        void app.dock.show()
      }
    }

    // Hide/restore menu bar — removes "Onpoint" from the top-left
    if (enable) {
      Menu.setApplicationMenu(null)
    } else {
      onRestoreMenu()
    }
  }

  function applyToWindow(window: BrowserWindow): void {
    if (active) {
      applyWindowState(window, true)
    }
  }

  function toggle(): void {
    const windows = getWindows()
    if (windows.length === 0) return

    active = !active

    applyGlobalState(active)
    for (const window of windows) {
      applyWindowState(window, active)
      window.webContents.send(GHOST_MODE_IPC_CHANNELS.stateChanged, active)
    }
  }

  function isActive(): boolean {
    return active
  }

  ipcMain.handle(GHOST_MODE_IPC_CHANNELS.getState, () => active)

  ipcMain.handle(GHOST_MODE_IPC_CHANNELS.getConfig, () => ({ ...config }))

  ipcMain.handle(
    GHOST_MODE_IPC_CHANNELS.setOpacity,
    async (_event, value: number): Promise<GhostModeConfig> => {
      config.opacity = clampOpacity(value)
      await saveConfig(config)

      // Apply immediately if ghost mode is active
      if (active) {
        for (const window of getWindows()) {
          window.setOpacity(config.opacity)
        }
      }

      return { ...config }
    }
  )

  function dispose(): void {
    if (active) {
      active = false
      applyGlobalState(false)
      for (const window of getWindows()) {
        applyWindowState(window, false)
      }
    }

    ipcMain.removeHandler(GHOST_MODE_IPC_CHANNELS.getState)
    ipcMain.removeHandler(GHOST_MODE_IPC_CHANNELS.getConfig)
    ipcMain.removeHandler(GHOST_MODE_IPC_CHANNELS.setOpacity)
  }

  return { initialize, toggle, isActive, applyToWindow, dispose }
}

export { createGhostModeService }
export type { GhostModeService }
