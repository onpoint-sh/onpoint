import { BrowserWindow, Menu, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import {
  WINDOW_CONTROL_MAXIMIZE_CHANGED_CHANNEL,
  WINDOW_CONTROL_FULLSCREEN_CHANGED_CHANNEL,
  WINDOW_CONTROL_ZOOM_FACTOR_CHANGED_CHANNEL
} from './register-window-controls'
import type { DetachedInitData } from '@onpoint/shared/window'

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
    title: ' ',
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
      sandbox: !is.dev,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: is.dev,
      spellcheck: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (restoredState?.isMaximized) {
      mainWindow.maximize()
    }
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Failed to load renderer: ${errorCode} ${errorDescription}`)
    mainWindow.show()
  })

  mainWindow.on('maximize', () => {
    emitMaximizeState(mainWindow)
  })

  mainWindow.on('unmaximize', () => {
    emitMaximizeState(mainWindow)
  })

  mainWindow.on('enter-full-screen', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(WINDOW_CONTROL_FULLSCREEN_CHANGED_CHANNEL, true)
    }
  })

  mainWindow.on('leave-full-screen', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(WINDOW_CONTROL_FULLSCREEN_CHANGED_CHANNEL, false)
    }
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

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return

    const menuItems: Electron.MenuItemConstructorOptions[] = []

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        menuItems.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        })
      }
      if (menuItems.length > 0) {
        menuItems.push({ type: 'separator' })
      }
    }

    menuItems.push(
      { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
    )

    Menu.buildFromTemplate(menuItems).popup()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Invalid URL — silently deny
    }
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
