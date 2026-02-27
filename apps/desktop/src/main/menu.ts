import { app, BrowserWindow, Menu } from 'electron'
import { handleInstallCli } from './cli-installer'

type MenuOptions = {
  onNewWindow: () => void
}

export function setupApplicationMenu(options: MenuOptions): void {
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
            const window = browserWindow ?? BrowserWindow.getAllWindows()[0]
            if (window && !window.isDestroyed()) {
              void window.webContents.executeJavaScript(
                `window.notes.pickVault()`
              )
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const }
            ]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
