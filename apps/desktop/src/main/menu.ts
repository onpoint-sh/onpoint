import { app, BrowserWindow, Menu } from 'electron'
import { handleInstallCli } from './cli-installer'

type MenuOptions = {
  onNewWindow: () => void
}

let cachedOptions: MenuOptions | null = null

export function setupApplicationMenu(options: MenuOptions): void {
  cachedOptions = options
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              {
                label: 'Install Command Line Tool…',
                click: (): void => {
                  void handleInstallCli()
                }
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: (_menuItem, browserWindow): void => {
            const window =
              browserWindow instanceof BrowserWindow
                ? browserWindow
                : BrowserWindow.getAllWindows()[0]
            if (window && !window.isDestroyed()) {
              window.webContents.send('menu:trigger-create-note')
            } else {
              options.onNewWindow()
            }
          }
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: (): void => {
            options.onNewWindow()
          }
        },
        { type: 'separator' },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: (_menuItem, browserWindow): void => {
            const window =
              browserWindow instanceof BrowserWindow
                ? browserWindow
                : BrowserWindow.getAllWindows()[0]
            if (window && !window.isDestroyed()) {
              window.webContents.send('menu:trigger-pick-vault')
            }
          }
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'Install Command Line Tool…',
                click: (): void => {
                  void handleInstallCli()
                }
              }
            ]
          : []),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: (_menuItem, browserWindow): void => {
            const window =
              browserWindow instanceof BrowserWindow
                ? browserWindow
                : BrowserWindow.getAllWindows()[0]
            if (window && !window.isDestroyed()) {
              window.webContents.toggleDevTools()
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

export function restoreApplicationMenu(): void {
  if (cachedOptions) {
    setupApplicationMenu(cachedOptions)
  }
}
