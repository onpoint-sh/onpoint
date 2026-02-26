import type { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'

export function createWindowId(): string {
  return randomUUID()
}

class WindowRegistry {
  private windows = new Map<string, BrowserWindow>()
  private webContentsIdToWindowId = new Map<number, string>()

  register(windowId: string, window: BrowserWindow): void {
    const webContentsId = window.webContents.id
    this.windows.set(windowId, window)
    this.webContentsIdToWindowId.set(webContentsId, windowId)

    window.on('closed', () => {
      this.windows.delete(windowId)
      this.webContentsIdToWindowId.delete(webContentsId)
    })
  }

  getWindow(windowId: string): BrowserWindow | undefined {
    const window = this.windows.get(windowId)
    if (!window || window.isDestroyed()) return undefined
    return window
  }

  getWindowId(window: BrowserWindow): string | undefined {
    if (window.isDestroyed()) return undefined
    return this.webContentsIdToWindowId.get(window.webContents.id)
  }

  getWindowIdByWebContentsId(webContentsId: number): string | undefined {
    return this.webContentsIdToWindowId.get(webContentsId)
  }

  getAllWindowIds(): string[] {
    return Array.from(this.windows.keys())
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).filter((w) => !w.isDestroyed())
  }

  size(): number {
    return this.windows.size
  }
}

export const windowRegistry = new WindowRegistry()
