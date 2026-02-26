import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { normalizeAccelerator } from './normalize'
import {
  SHORTCUT_ACTION_IDS,
  isShortcutActionId,
  type ShortcutOverrides
} from '../../shared/shortcuts'

type StoredShortcutOverrides = {
  version: 1
  overrides: Record<string, string>
}

const SHORTCUTS_STORE_FILE_NAME = 'shortcuts.v1.json'

function getShortcutsStorePath(): string {
  return join(app.getPath('userData'), SHORTCUTS_STORE_FILE_NAME)
}

function sanitizeOverrides(value: unknown): ShortcutOverrides {
  if (!value || typeof value !== 'object') return {}

  const maybeOverrides =
    'overrides' in value && value.overrides && typeof value.overrides === 'object'
      ? (value.overrides as Record<string, unknown>)
      : {}

  const sanitizedOverrides: ShortcutOverrides = {}

  for (const actionId of SHORTCUT_ACTION_IDS) {
    const candidate = maybeOverrides[actionId]
    if (typeof candidate !== 'string') continue
    const normalizedAccelerator = normalizeAccelerator(candidate)
    if (!normalizedAccelerator) continue
    sanitizedOverrides[actionId] = normalizedAccelerator
  }

  return sanitizedOverrides
}

function toStoredOverrides(overrides: ShortcutOverrides): StoredShortcutOverrides {
  const normalizedOverrides: Record<string, string> = {}

  for (const [actionId, accelerator] of Object.entries(overrides)) {
    if (!isShortcutActionId(actionId)) continue
    if (typeof accelerator !== 'string') continue
    const normalizedAccelerator = normalizeAccelerator(accelerator)
    if (!normalizedAccelerator) continue
    normalizedOverrides[actionId] = normalizedAccelerator
  }

  return {
    version: 1,
    overrides: normalizedOverrides
  }
}

export async function loadShortcutOverrides(): Promise<ShortcutOverrides> {
  try {
    const rawValue = await fs.readFile(getShortcutsStorePath(), 'utf-8')
    const parsedValue = JSON.parse(rawValue) as unknown
    return sanitizeOverrides(parsedValue)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }

    console.warn('Failed to read shortcuts configuration, using defaults.', error)
    return {}
  }
}

export async function saveShortcutOverrides(overrides: ShortcutOverrides): Promise<void> {
  const storedOverrides = toStoredOverrides(overrides)
  const filePath = getShortcutsStorePath()
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(storedOverrides, null, 2), 'utf-8')
}
