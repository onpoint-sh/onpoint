import { join, dirname } from 'node:path'
import {
  existsSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  chmodSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { app, dialog } from 'electron'

function macosElevated(command: string, args: string[]): void {
  // Write a temp script with args embedded (avoids shell/AppleScript injection)
  const tmpDir = mkdtempSync(join(tmpdir(), 'onpoint-'))
  chmodSync(tmpDir, 0o700)
  const scriptPath = join(tmpDir, 'run.sh')
  try {
    const quotedArgs = args.map((a) => "'" + a.replace(/'/g, "'\\''") + "'").join(' ')
    writeFileSync(scriptPath, `#!/bin/sh\nexec ${command} ${quotedArgs}\n`, { mode: 0o700 })
    // scriptPath is a temp dir path with no special chars — safe to embed directly
    execFileSync('osascript', [
      '-e',
      `do shell script "${scriptPath}" with administrator privileges`
    ])
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

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
    throw new Error(
      `CLI binary not found at ${source}. Build it first with: pnpm --filter @onpoint/cli build:sea`
    )
  }

  // Ensure target directory exists
  const targetDir = dirname(target)
  if (!existsSync(targetDir)) {
    if (process.platform === 'win32') {
      const { mkdirSync } = await import('node:fs')
      mkdirSync(targetDir, { recursive: true })
    }
  }

  // Create symlink, handling existing files atomically
  try {
    symlinkSync(source, target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      unlinkSync(target)
      symlinkSync(source, target)
      return
    }
    if ((err as NodeJS.ErrnoException).code !== 'EACCES') throw err

    // Permission denied — escalate with admin privileges
    if (process.platform === 'darwin') {
      macosElevated('/bin/ln', ['-sf', source, target])
    } else if (process.platform === 'linux') {
      execFileSync('pkexec', ['ln', '-sf', source, target])
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
      macosElevated('/bin/rm', [target])
    } else if (process.platform === 'linux') {
      execFileSync('pkexec', ['rm', target])
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
