import { join, dirname } from 'node:path'
import { existsSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { app, dialog } from 'electron'

const BINARY_NAME = process.platform === 'win32' ? 'onpoint.exe' : 'onpoint'

function getCliBinaryPath(): string {
  if (!app.isPackaged) {
    // In dev, use the built binary from the CLI package
    return join(app.getAppPath(), '..', '..', 'apps', 'cli', 'dist', BINARY_NAME)
  }
  return join(process.resourcesPath, 'bin', BINARY_NAME)
}

function getInstallPath(): string {
  if (process.platform === 'win32') {
    return join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'onpoint', BINARY_NAME)
  }
  return '/usr/local/bin/onpoint'
}

function isCliInstalled(): boolean {
  const installPath = getInstallPath()
  try {
    if (!existsSync(installPath)) return false
    const target = readlinkSync(installPath)
    return target === getCliBinaryPath()
  } catch {
    // readlinkSync throws if path is not a symlink (e.g. a regular file)
    return false
  }
}

async function installCli(): Promise<void> {
  const source = getCliBinaryPath()
  const target = getInstallPath()

  if (!existsSync(source)) {
    throw new Error(`CLI binary not found at ${source}. Build it first with: pnpm --filter @onpoint/cli build:sea`)
  }

  // Ensure target directory exists
  const targetDir = dirname(target)
  if (!existsSync(targetDir)) {
    if (process.platform === 'win32') {
      const { mkdirSync } = await import('node:fs')
      mkdirSync(targetDir, { recursive: true })
    }
  }

  // Remove existing symlink/file if present
  try {
    if (existsSync(target)) {
      unlinkSync(target)
    }
    symlinkSync(source, target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EACCES') throw err

    // Permission denied — escalate via osascript on macOS
    if (process.platform === 'darwin') {
      const escapedSource = source.replace(/"/g, '\\"')
      const escapedTarget = target.replace(/"/g, '\\"')
      execSync(
        `osascript -e 'do shell script "ln -sf \\"${escapedSource}\\" \\"${escapedTarget}\\"" with administrator privileges'`
      )
    } else if (process.platform === 'linux') {
      execSync(`pkexec ln -sf "${source}" "${target}"`)
    } else {
      throw err
    }
  }
}

async function uninstallCli(): Promise<void> {
  const target = getInstallPath()

  if (!existsSync(target)) return

  try {
    unlinkSync(target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EACCES') throw err

    if (process.platform === 'darwin') {
      const escapedTarget = target.replace(/"/g, '\\"')
      execSync(
        `osascript -e 'do shell script "rm \\"${escapedTarget}\\"" with administrator privileges'`
      )
    } else if (process.platform === 'linux') {
      execSync(`pkexec rm "${target}"`)
    } else {
      throw err
    }
  }
}

export async function handleInstallCli(): Promise<void> {
  const installed = isCliInstalled()

  if (installed) {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      message: 'Command Line Tool Already Installed',
      detail: `The 'onpoint' command is already available at ${getInstallPath()}.`,
      buttons: ['OK', 'Reinstall', 'Uninstall'],
      defaultId: 0
    })

    if (response === 1) {
      try {
        await installCli()
        await dialog.showMessageBox({
          type: 'info',
          message: 'Command Line Tool Reinstalled',
          detail: `The 'onpoint' command has been reinstalled at ${getInstallPath()}.`
        })
      } catch (err) {
        await dialog.showMessageBox({
          type: 'error',
          message: 'Installation Failed',
          detail: String(err)
        })
      }
    } else if (response === 2) {
      try {
        await uninstallCli()
        await dialog.showMessageBox({
          type: 'info',
          message: 'Command Line Tool Uninstalled',
          detail: `The 'onpoint' command has been removed from ${getInstallPath()}.`
        })
      } catch (err) {
        await dialog.showMessageBox({
          type: 'error',
          message: 'Uninstall Failed',
          detail: String(err)
        })
      }
    }
    return
  }

  try {
    await installCli()
    await dialog.showMessageBox({
      type: 'info',
      message: 'Command Line Tool Installed',
      detail: `The 'onpoint' command is now available.\n\nOpen a new terminal and run: onpoint --help`
    })
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      message: 'Installation Failed',
      detail: String(err)
    })
  }
}
