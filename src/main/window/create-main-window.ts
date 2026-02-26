import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import {
  WINDOW_CONTROL_MAXIMIZE_CHANGED_CHANNEL,
  WINDOW_CONTROL_ZOOM_FACTOR_CHANGED_CHANNEL
} from './register-window-controls'
import type { DetachedInitData } from '../../shared/window'

function emitMaximizeState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  window.webContents.send(WINDOW_CONTROL_MAXIMIZE_CHANGED_CHANNEL, window.isMaximized())
}

function emitZoomFactorState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  window.webContents.send(
    WINDOW_CONTROL_ZOOM_FACTOR_CHANGED_CHANNEL,
    window.webContents.getZoomFactor()
  )
}

type WindowStateOptions = {
  x?: number
  y?: number
  width?: number
  height?: number
  isMaximized?: boolean
  zoomFactor?: number
}

type CreateMainWindowOptions = {
  windowId: string
  restoredState?: WindowStateOptions
  isDetached?: boolean
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const { windowId, restoredState, isDetached } = options
  const isMac = process.platform === 'darwin'

  const positionOpts =
    restoredState && restoredState.x !== undefined && restoredState.x !== -1
      ? { x: restoredState.x, y: restoredState.y }
      : {}

  const mainWindow = new BrowserWindow({
    width: restoredState?.width ?? 900,
    height: restoredState?.height ?? 670,
    ...positionOpts,
    show: false,
    autoHideMenuBar: true,
    frame: isMac,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 12 }
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (restoredState?.isMaximized) {
      mainWindow.maximize()
    }
    mainWindow.show()
  })

  mainWindow.on('maximize', () => {
    emitMaximizeState(mainWindow)
  })

  mainWindow.on('unmaximize', () => {
    emitMaximizeState(mainWindow)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (restoredState?.zoomFactor && restoredState.zoomFactor !== 1) {
      mainWindow.webContents.setZoomFactor(restoredState.zoomFactor)
    }
    emitMaximizeState(mainWindow)
    emitZoomFactorState(mainWindow)
  })

  mainWindow.webContents.on('zoom-changed', () => {
    emitZoomFactorState(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const query: Record<string, string> = { windowId }
  if (isDetached) {
    query.detached = '1'
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const params = new URLSearchParams(query)
    mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${params.toString()}`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  return mainWindow
}

/** Stores init data for detached windows, keyed by webContents ID. */
const pendingDetachInit = new Map<number, DetachedInitData>()

export function getDetachInitData(webContentsId: number): DetachedInitData | null {
  const data = pendingDetachInit.get(webContentsId) ?? null
  if (data) pendingDetachInit.delete(webContentsId)
  return data
}

export function setPendingDetachInit(webContentsId: number, data: DetachedInitData): void {
  pendingDetachInit.set(webContentsId, data)
}
