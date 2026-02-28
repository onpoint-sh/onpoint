import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

export type WindowState = {
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
  zoomFactor: number
  isDetached?: boolean
}

type StoredMultiWindowState = {
  version: 2
  windows: Record<string, WindowState>
}

// Legacy single-window format for migration
type StoredLegacyWindowState = WindowState & { version: 1 }

const MULTI_CONFIG_FILE_NAME = 'windows.v2.json'
const LEGACY_CONFIG_FILE_NAME = 'window-state.v1.json'

export const DEFAULTS: WindowState = {
  x: -1,
  y: -1,
  width: 900,
  height: 670,
  isMaximized: false,
  zoomFactor: 1,
  isDetached: false
}

function getMultiConfigPath(): string {
  return join(app.getPath('userData'), MULTI_CONFIG_FILE_NAME)
}

function getLegacyConfigPath(): string {
  return join(app.getPath('userData'), LEGACY_CONFIG_FILE_NAME)
}

function isVisibleOnAnyDisplay(bounds: Rectangle): boolean {
  const displays = screen.getAllDisplays()
  return displays.some((display) => {
    const { x, y, width, height } = display.workArea
    return (
      bounds.x + bounds.width > x + 100 &&
      bounds.x < x + width - 100 &&
      bounds.y + bounds.height > y + 100 &&
      bounds.y < y + height - 100
    )
  })
}

function sanitizeWindowState(parsed: Partial<WindowState>): WindowState {
  const state: WindowState = {
    x: typeof parsed.x === 'number' ? parsed.x : DEFAULTS.x,
    y: typeof parsed.y === 'number' ? parsed.y : DEFAULTS.y,
    width: typeof parsed.width === 'number' && parsed.width >= 400 ? parsed.width : DEFAULTS.width,
    height:
      typeof parsed.height === 'number' && parsed.height >= 300 ? parsed.height : DEFAULTS.height,
    isMaximized:
      typeof parsed.isMaximized === 'boolean' ? parsed.isMaximized : DEFAULTS.isMaximized,
    zoomFactor:
      typeof parsed.zoomFactor === 'number' && parsed.zoomFactor >= 0.5 && parsed.zoomFactor <= 3
        ? parsed.zoomFactor
        : DEFAULTS.zoomFactor,
    isDetached: typeof parsed.isDetached === 'boolean' ? parsed.isDetached : DEFAULTS.isDetached
  }

  if (state.x !== DEFAULTS.x && state.y !== DEFAULTS.y) {
    if (
      !isVisibleOnAnyDisplay({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height
      })
    ) {
      state.x = DEFAULTS.x
      state.y = DEFAULTS.y
    }
  }

  return state
}

function loadLegacyWindowState(): WindowState | null {
  try {
    const legacyPath = getLegacyConfigPath()
    if (!existsSync(legacyPath)) return null
    const raw = readFileSync(legacyPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoredLegacyWindowState>
    return sanitizeWindowState(parsed)
  } catch {
    return null
  }
}

export function loadAllWindowStates(): Record<string, WindowState> {
  try {
    const multiPath = getMultiConfigPath()
    if (existsSync(multiPath)) {
      const raw = readFileSync(multiPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<StoredMultiWindowState>

      if (parsed.windows && typeof parsed.windows === 'object') {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const result: Record<string, WindowState> = {}
        for (const [id, state] of Object.entries(parsed.windows)) {
          if (id !== 'main' && !UUID_RE.test(id)) continue
          if (state && typeof state === 'object') {
            result[id] = sanitizeWindowState(state as Partial<WindowState>)
          }
        }
        if (Object.keys(result).length > 0) return result
      }
    }

    // Migration: try legacy single-window state
    const legacyState = loadLegacyWindowState()
    if (legacyState) {
      return { main: legacyState }
    }

    return {}
  } catch {
    return {}
  }
}

// Atomic write: write to temp file then rename
function atomicWriteJSON(filePath: string, data: unknown): void {
  const tmpPath = filePath + '.tmp'
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, filePath)
}

export function saveAllWindowStates(states: Record<string, WindowState>): void {
  const stored: StoredMultiWindowState = { version: 2, windows: states }
  atomicWriteJSON(getMultiConfigPath(), stored)
}

// In-memory tracked states for all windows
const trackedStates = new Map<string, WindowState>()

export function trackWindowState(
  windowId: string,
  window: BrowserWindow,
  initialOverrides?: Partial<WindowState>
): { save: () => void; remove: () => void } {
  const state: WindowState = { ...DEFAULTS, ...initialOverrides }

  function updateBounds(): void {
    if (window.isDestroyed() || window.isMaximized() || window.isMinimized()) return
    const bounds = window.getBounds()
    state.x = bounds.x
    state.y = bounds.y
    state.width = bounds.width
    state.height = bounds.height
    trackedStates.set(windowId, { ...state })
  }

  function updateMaximized(): void {
    if (window.isDestroyed()) return
    state.isMaximized = window.isMaximized()
    trackedStates.set(windowId, { ...state })
  }

  function updateZoom(): void {
    if (window.isDestroyed()) return
    state.zoomFactor = window.webContents.getZoomFactor()
    trackedStates.set(windowId, { ...state })
  }

  updateBounds()
  updateMaximized()
  trackedStates.set(windowId, { ...state })

  window.on('resize', updateBounds)
  window.on('move', updateBounds)
  window.on('maximize', updateMaximized)
  window.on('unmaximize', () => {
    updateMaximized()
    updateBounds()
  })
  window.webContents.on('zoom-changed', updateZoom)

  return {
    save: () => {
      trackedStates.set(windowId, { ...state })
    },
    remove: () => {
      trackedStates.delete(windowId)
    }
  }
}

export function saveAllTrackedStates(): void {
  saveAllWindowStates(Object.fromEntries(trackedStates))
}
