import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'

const INVOKE_CHANNELS = {
  minimize: 'window-controls:minimize',
  toggleMaximize: 'window-controls:toggle-maximize',
  close: 'window-controls:close',
  isMaximized: 'window-controls:is-maximized',
  isFullScreen: 'window-controls:is-full-screen',
  zoomIn: 'window-controls:zoom-in',
  zoomOut: 'window-controls:zoom-out',
  resetZoom: 'window-controls:reset-zoom',
  getZoomFactor: 'window-controls:get-zoom-factor'
} as const

export const WINDOW_CONTROL_MAXIMIZE_CHANGED_CHANNEL = 'window-controls:maximize-changed'
export const WINDOW_CONTROL_FULLSCREEN_CHANGED_CHANNEL = 'window-controls:full-screen-changed'
export const WINDOW_CONTROL_ZOOM_FACTOR_CHANGED_CHANNEL = 'window-controls:zoom-factor-changed'
const WINDOW_ZOOM_STEP = 0.5
const WINDOW_ZOOM_MIN_LEVEL = -5
const WINDOW_ZOOM_MAX_LEVEL = 5

function getWindowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function clampZoomLevel(level: number): number {
  return Math.min(Math.max(level, WINDOW_ZOOM_MIN_LEVEL), WINDOW_ZOOM_MAX_LEVEL)
}

function adjustZoom(window: BrowserWindow, delta: number): void {
  const currentZoomLevel = window.webContents.getZoomLevel()
  const nextZoomLevel = clampZoomLevel(currentZoomLevel + delta)
  window.webContents.setZoomLevel(nextZoomLevel)
  window.webContents.send(
    WINDOW_CONTROL_ZOOM_FACTOR_CHANGED_CHANNEL,
    window.webContents.getZoomFactor()
  )
}

export function registerWindowControls(): void {
  ipcMain.removeHandler(INVOKE_CHANNELS.minimize)
  ipcMain.removeHandler(INVOKE_CHANNELS.toggleMaximize)
  ipcMain.removeHandler(INVOKE_CHANNELS.close)
  ipcMain.removeHandler(INVOKE_CHANNELS.isMaximized)
  ipcMain.removeHandler(INVOKE_CHANNELS.isFullScreen)
  ipcMain.removeHandler(INVOKE_CHANNELS.zoomIn)
  ipcMain.removeHandler(INVOKE_CHANNELS.zoomOut)
  ipcMain.removeHandler(INVOKE_CHANNELS.resetZoom)
  ipcMain.removeHandler(INVOKE_CHANNELS.getZoomFactor)

  ipcMain.handle(INVOKE_CHANNELS.minimize, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return
    window.minimize()
  })

  ipcMain.handle(INVOKE_CHANNELS.toggleMaximize, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return false

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }

    return window.isMaximized()
  })

  ipcMain.handle(INVOKE_CHANNELS.close, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return
    window.close()
  })

  ipcMain.handle(INVOKE_CHANNELS.isMaximized, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return false
    return window.isMaximized()
  })

  ipcMain.handle(INVOKE_CHANNELS.isFullScreen, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return false
    return window.isFullScreen()
  })

  ipcMain.handle(INVOKE_CHANNELS.zoomIn, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return
    adjustZoom(window, WINDOW_ZOOM_STEP)
  })

  ipcMain.handle(INVOKE_CHANNELS.zoomOut, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return
    adjustZoom(window, -WINDOW_ZOOM_STEP)
  })

  ipcMain.handle(INVOKE_CHANNELS.resetZoom, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return
    window.webContents.setZoomLevel(0)
    window.webContents.send(
      WINDOW_CONTROL_ZOOM_FACTOR_CHANGED_CHANNEL,
      window.webContents.getZoomFactor()
    )
  })

  ipcMain.handle(INVOKE_CHANNELS.getZoomFactor, (event) => {
    const window = getWindowFromEvent(event)
    if (!window || window.isDestroyed()) return 1
    return window.webContents.getZoomFactor()
  })
}
