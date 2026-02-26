import { app, BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import {
  createMainWindow,
  getDetachInitData,
  setPendingDetachInit
} from './window/create-main-window'
import { createGhostModeService } from './window/ghost-mode'
import {
  loadAllWindowStates,
  trackWindowState,
  saveAllTrackedStates,
  type WindowState
} from './window/window-state'
import { windowRegistry, createWindowId } from './window/window-registry'
import { registerWindowControls } from './window/register-window-controls'
import { registerContextMenu } from './window/context-menu'
import { setupApplicationMenu } from './menu'
import { createShortcutService } from './shortcuts'
import { registerNotesIpc } from './notes/ipc'
import { copyNotesConfig, deleteNotesConfig } from './notes/store'
import { WINDOW_IPC_CHANNELS } from '@onpoint/shared/window'

type WindowTracker = { save: () => void; remove: () => void }
const windowTrackers = new Map<string, WindowTracker>()

let isQuitting = false

function createAppWindow(
  windowId?: string,
  restoredState?: WindowState,
  opts?: { isDetached?: boolean }
): BrowserWindow {
  const id = windowId ?? createWindowId()
  const isDetached = opts?.isDetached ?? restoredState?.isDetached ?? false

  const window = createMainWindow({ windowId: id, restoredState, isDetached })
  windowRegistry.register(id, window)

  const tracker = trackWindowState(id, window, { isDetached })
  windowTrackers.set(id, tracker)

  window.on('close', () => {
    tracker.save()
  })

  window.on('closed', () => {
    if (!isQuitting) {
      tracker.remove()
      if (id !== 'main') {
        void deleteNotesConfig(id)
      }
    }
    windowTrackers.delete(id)
  })

  return window
}

function createNewWindow(): BrowserWindow {
  return createAppWindow()
}

app.whenReady().then(() => {
  const savedStates = loadAllWindowStates()

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window, { zoom: true })
  })

  setupApplicationMenu({ onNewWindow: createNewWindow })
  registerWindowControls()
  registerContextMenu()

  // Handle new window IPC from renderer
  ipcMain.handle(WINDOW_IPC_CHANNELS.newWindow, () => {
    createNewWindow()
  })

  // Handle getWindowId IPC
  ipcMain.handle(WINDOW_IPC_CHANNELS.getWindowId, (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return windowRegistry.getWindowId(window) ?? null
  })

  // Detach tab handler — creates a new first-class window for the dragged tab
  ipcMain.handle(
    WINDOW_IPC_CHANNELS.detachTab,
    async (event: IpcMainInvokeEvent, relativePath: string, force?: boolean): Promise<boolean> => {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender)
      if (!sourceWindow || sourceWindow.isDestroyed()) return false
      const parentWindowId = windowRegistry.getWindowId(sourceWindow) ?? 'main'

      const cursor = screen.getCursorScreenPoint()
      const bounds = sourceWindow.getBounds()
      const margin = 10

      const isOutside =
        cursor.x < bounds.x - margin ||
        cursor.x > bounds.x + bounds.width + margin ||
        cursor.y < bounds.y - margin ||
        cursor.y > bounds.y + bounds.height + margin

      if (!force && !isOutside) return false

      const newWindowId = createWindowId()

      // Copy parent's notes config so the new window has the same vaultPath
      await copyNotesConfig(parentWindowId, newWindowId)

      const newWindow = createAppWindow(
        newWindowId,
        {
          x: cursor.x - 100,
          y: cursor.y - 20,
          width: 700,
          height: 500,
          isMaximized: false,
          zoomFactor: sourceWindow.webContents.getZoomFactor(),
          isDetached: true
        },
        { isDetached: true }
      )

      setPendingDetachInit(newWindow.webContents.id, { relativePath })

      return true
    }
  )

  ipcMain.handle(WINDOW_IPC_CHANNELS.getDetachInit, (event: IpcMainInvokeEvent) => {
    return getDetachInitData(event.sender.id)
  })

  const unregisterNotesIpc = registerNotesIpc()

  const ghostModeService = createGhostModeService({
    getWindow: () => {
      const allWindows = windowRegistry.getAllWindows()
      return allWindows[0] && !allWindows[0].isDestroyed() ? allWindows[0] : undefined
    }
  })

  const shortcutService = createShortcutService({
    getWindows: () => windowRegistry.getAllWindows(),
    onGlobalAction: (actionId) => {
      if (actionId === 'toggle_ghost_mode') {
        ghostModeService.toggle()
        return
      }

      if (actionId === 'show_main_window') {
        const allWindows = windowRegistry.getAllWindows()
        if (allWindows.length === 0) {
          createAppWindow('main')
          return
        }
        const window = allWindows[0]
        if (window.isMinimized()) window.restore()
        if (!window.isVisible()) window.show()
        window.focus()
        return
      }
    }
  })

  void ghostModeService.initialize()
  void shortcutService.initialize()

  // Restore windows from saved state, or create a default "main" window
  const windowIds = Object.keys(savedStates)
  if (windowIds.length === 0) {
    createAppWindow('main')
  } else {
    for (const id of windowIds) {
      createAppWindow(id, savedStates[id])
    }
  }

  app.on('activate', function () {
    if (windowRegistry.size() === 0) {
      createAppWindow('main')
    }
  })

  app.on('before-quit', () => {
    isQuitting = true
    saveAllTrackedStates()
  })

  app.on('will-quit', () => {
    ghostModeService.dispose()
    unregisterNotesIpc()
    shortcutService.dispose()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
