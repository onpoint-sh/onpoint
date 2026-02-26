import { app, type BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import {
  GHOST_MODE_IPC_CHANNELS,
  DEFAULT_GHOST_MODE_CONFIG,
  GHOST_MODE_OPACITY_MIN,
  GHOST_MODE_OPACITY_MAX,
  type GhostModeConfig
} from '../../shared/ghost-mode'

type GhostModeServiceOptions = {
  getWindow: () => BrowserWindow | undefined
}

type GhostModeService = {
  initialize: () => Promise<void>
  toggle: () => void
  isActive: () => boolean
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
  return Math.round(Math.max(GHOST_MODE_OPACITY_MIN, Math.min(GHOST_MODE_OPACITY_MAX, value)) * 100) / 100
}

function createGhostModeService({ getWindow }: GhostModeServiceOptions): GhostModeService {
  let active = false
  let config: GhostModeConfig = { ...DEFAULT_GHOST_MODE_CONFIG }

  async function initialize(): Promise<void> {
    config = await loadConfig()
  }

  function applyState(window: BrowserWindow, enable: boolean): void {
    window.setContentProtection(enable)
    window.setAlwaysOnTop(enable, enable ? 'screen-saver' : 'normal')
    window.setOpacity(enable ? config.opacity : 1.0)
    window.setVisibleOnAllWorkspaces(enable)
    window.setSkipTaskbar(enable)

    // On macOS, setSkipTaskbar is a no-op — the dock icon is per-app, not per-window.
    // Use app.dock.hide()/show() to toggle dock visibility.
    if (app.dock) {
      if (enable) {
        app.dock.hide()
      } else {
        void app.dock.show()
      }
    }
  }

  function toggle(): void {
    const window = getWindow()
    if (!window || window.isDestroyed()) return

    active = !active
    applyState(window, active)
    window.webContents.send(GHOST_MODE_IPC_CHANNELS.stateChanged, active)
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
      const window = getWindow()
      if (active && window && !window.isDestroyed()) {
        window.setOpacity(config.opacity)
      }

      return { ...config }
    }
  )

  function dispose(): void {
    const window = getWindow()
    if (window && !window.isDestroyed() && active) {
      active = false
      applyState(window, false)
    }

    ipcMain.removeHandler(GHOST_MODE_IPC_CHANNELS.getState)
    ipcMain.removeHandler(GHOST_MODE_IPC_CHANNELS.getConfig)
    ipcMain.removeHandler(GHOST_MODE_IPC_CHANNELS.setOpacity)
  }

  return { initialize, toggle, isActive, dispose }
}

export { createGhostModeService }
export type { GhostModeService }
