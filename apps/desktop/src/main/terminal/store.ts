import { app } from 'electron'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import {
  DEFAULT_TERMINAL_SETTINGS,
  type TerminalSettings,
  type TerminalBellStyle,
  type TerminalCursorStyle,
  type TerminalRendererType
} from '@onpoint/shared/terminal'

type PersistedTerminalSettings = {
  settings: TerminalSettings
}

const TERMINAL_STORE_FILE_NAME = 'terminal.v1.json'

function getTerminalStorePath(windowId: string): string {
  if (windowId === 'main') {
    return join(app.getPath('userData'), TERMINAL_STORE_FILE_NAME)
  }

  return join(app.getPath('userData'), `terminal.${windowId}.v1.json`)
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizeShellArgs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 32)
}

function normalizeTerminalSettings(input: unknown): TerminalSettings {
  const value = input && typeof input === 'object' ? (input as Partial<TerminalSettings>) : {}

  const rendererType: TerminalRendererType =
    value.rendererType === 'auto' || value.rendererType === 'canvas' || value.rendererType === 'dom'
      ? value.rendererType
      : DEFAULT_TERMINAL_SETTINGS.rendererType

  const cursorStyle: TerminalCursorStyle =
    value.cursorStyle === 'block' ||
    value.cursorStyle === 'underline' ||
    value.cursorStyle === 'bar'
      ? value.cursorStyle
      : DEFAULT_TERMINAL_SETTINGS.cursorStyle

  const bellStyle: TerminalBellStyle =
    value.bellStyle === 'none' || value.bellStyle === 'sound' || value.bellStyle === 'visual'
      ? value.bellStyle
      : DEFAULT_TERMINAL_SETTINGS.bellStyle

  const shellPath =
    typeof value.shellPath === 'string' && value.shellPath.trim().length > 0
      ? value.shellPath.trim()
      : null

  return {
    fontFamily:
      typeof value.fontFamily === 'string' && value.fontFamily.trim().length > 0
        ? value.fontFamily
        : DEFAULT_TERMINAL_SETTINGS.fontFamily,
    fontSize: clampNumber(value.fontSize, DEFAULT_TERMINAL_SETTINGS.fontSize, 10, 28),
    lineHeight: clampNumber(value.lineHeight, DEFAULT_TERMINAL_SETTINGS.lineHeight, 1, 2),
    letterSpacing: clampNumber(value.letterSpacing, DEFAULT_TERMINAL_SETTINGS.letterSpacing, -2, 5),
    cursorStyle,
    cursorBlink:
      typeof value.cursorBlink === 'boolean'
        ? value.cursorBlink
        : DEFAULT_TERMINAL_SETTINGS.cursorBlink,
    scrollback: clampNumber(value.scrollback, DEFAULT_TERMINAL_SETTINGS.scrollback, 1000, 100000),
    rendererType,
    bellStyle,
    copyOnSelect:
      typeof value.copyOnSelect === 'boolean'
        ? value.copyOnSelect
        : DEFAULT_TERMINAL_SETTINGS.copyOnSelect,
    shellPath,
    shellArgs: normalizeShellArgs(value.shellArgs)
  }
}

const settingsCache = new Map<string, TerminalSettings>()

async function readSettingsFile(path: string): Promise<TerminalSettings | null> {
  try {
    const raw = await fs.readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedTerminalSettings>
    return normalizeTerminalSettings(parsed.settings)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    return { ...DEFAULT_TERMINAL_SETTINGS }
  }
}

async function writeSettingsFile(path: string, settings: TerminalSettings): Promise<void> {
  const payload: PersistedTerminalSettings = { settings }
  await fs.writeFile(path, JSON.stringify(payload, null, 2), 'utf-8')
}

export async function loadTerminalSettings(windowId: string): Promise<TerminalSettings> {
  const cached = settingsCache.get(windowId)
  if (cached) return cached

  const path = getTerminalStorePath(windowId)
  const settings = await readSettingsFile(path)

  if (settings) {
    settingsCache.set(windowId, settings)
    return settings
  }

  if (windowId !== 'main') {
    const mainSettings = await loadTerminalSettings('main')
    settingsCache.set(windowId, mainSettings)
    return mainSettings
  }

  const fallback = { ...DEFAULT_TERMINAL_SETTINGS }
  settingsCache.set(windowId, fallback)
  return fallback
}

export async function saveTerminalSettings(
  windowId: string,
  settings: TerminalSettings
): Promise<void> {
  const normalized = normalizeTerminalSettings(settings)
  settingsCache.set(windowId, normalized)
  await writeSettingsFile(getTerminalStorePath(windowId), normalized)
}

export async function copyTerminalSettings(
  fromWindowId: string,
  toWindowId: string
): Promise<void> {
  const settings = await loadTerminalSettings(fromWindowId)
  await saveTerminalSettings(toWindowId, settings)
}

export async function deleteTerminalSettings(windowId: string): Promise<void> {
  if (windowId === 'main') return

  settingsCache.delete(windowId)

  try {
    await fs.unlink(getTerminalStorePath(windowId))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Failed to delete terminal settings for window ${windowId}`, error)
    }
  }
}

export function mergeTerminalSettings(
  base: TerminalSettings,
  patch: Partial<TerminalSettings>
): TerminalSettings {
  return normalizeTerminalSettings({
    ...base,
    ...patch
  })
}
