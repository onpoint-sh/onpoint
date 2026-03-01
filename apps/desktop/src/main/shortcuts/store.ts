import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { normalizeAccelerator } from './normalize'
import {
  SHORTCUT_ACTION_IDS,
  isShortcutActionId,
  normalizeShortcutWhen,
  type ShortcutOverrides,
  type ShortcutScope
} from '@onpoint/shared/shortcuts'

type StoredShortcutOverridesV1 = {
  version: 1
  overrides: Record<string, string>
}

type StoredShortcutOverrideV2 = {
  accelerator?: string
  scope?: ShortcutScope
  when?: string
}

type StoredShortcutOverridesV2 = {
  version: 2
  overrides: Record<string, StoredShortcutOverrideV2>
}

type LoadShortcutOverridesResult = {
  overrides: ShortcutOverrides
  needsRewrite: boolean
}

const SHORTCUTS_STORE_FILE_NAME_V1 = 'shortcuts.v1.json'
const SHORTCUTS_STORE_FILE_NAME_V2 = 'shortcuts.v2.json'

function getShortcutsStorePathV1(): string {
  return join(app.getPath('userData'), SHORTCUTS_STORE_FILE_NAME_V1)
}

function getShortcutsStorePathV2(): string {
  return join(app.getPath('userData'), SHORTCUTS_STORE_FILE_NAME_V2)
}

function isShortcutScope(value: unknown): value is ShortcutScope {
  return value === 'window' || value === 'global'
}

function sanitizeStoredOverride(value: unknown): StoredShortcutOverrideV2 {
  if (!value || typeof value !== 'object') return {}

  const override = value as Record<string, unknown>
  const sanitized: StoredShortcutOverrideV2 = {}

  if (typeof override.accelerator === 'string') {
    const normalizedAccelerator = normalizeAccelerator(override.accelerator)
    if (normalizedAccelerator) {
      sanitized.accelerator = normalizedAccelerator
    }
  }

  if (isShortcutScope(override.scope)) {
    sanitized.scope = override.scope
  }

  if (typeof override.when === 'string') {
    const normalizedWhen = normalizeShortcutWhen(override.when)
    if (normalizedWhen) {
      sanitized.when = normalizedWhen
    }
  }

  return sanitized
}

function sanitizeV2Overrides(value: unknown): ShortcutOverrides {
  if (!value || typeof value !== 'object') return {}

  const maybeOverrides =
    'overrides' in value && value.overrides && typeof value.overrides === 'object'
      ? (value.overrides as Record<string, unknown>)
      : {}

  const sanitizedOverrides: ShortcutOverrides = {}

  for (const actionId of SHORTCUT_ACTION_IDS) {
    const candidate = sanitizeStoredOverride(maybeOverrides[actionId])
    if (!candidate.accelerator && !candidate.scope && !candidate.when) continue
    sanitizedOverrides[actionId] = candidate
  }

  return sanitizedOverrides
}

function sanitizeV1Overrides(value: unknown): ShortcutOverrides {
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

    sanitizedOverrides[actionId] = {
      accelerator: normalizedAccelerator
    }
  }

  return sanitizedOverrides
}

function toStoredOverridesV2(overrides: ShortcutOverrides): StoredShortcutOverridesV2 {
  const normalizedOverrides: Record<string, StoredShortcutOverrideV2> = {}

  for (const [actionId, override] of Object.entries(overrides)) {
    if (!isShortcutActionId(actionId)) continue
    if (!override || typeof override !== 'object') continue

    const normalizedOverride: StoredShortcutOverrideV2 = {}

    if (typeof override.accelerator === 'string') {
      const normalizedAccelerator = normalizeAccelerator(override.accelerator)
      if (normalizedAccelerator) {
        normalizedOverride.accelerator = normalizedAccelerator
      }
    }

    if (isShortcutScope(override.scope)) {
      normalizedOverride.scope = override.scope
    }

    if (typeof override.when === 'string') {
      const normalizedWhen = normalizeShortcutWhen(override.when)
      if (normalizedWhen) {
        normalizedOverride.when = normalizedWhen
      }
    }

    if (
      normalizedOverride.accelerator ||
      normalizedOverride.scope ||
      typeof normalizedOverride.when === 'string'
    ) {
      normalizedOverrides[actionId] = normalizedOverride
    }
  }

  return {
    version: 2,
    overrides: normalizedOverrides
  }
}

async function loadFromV1Store(): Promise<LoadShortcutOverridesResult> {
  try {
    const rawValue = await fs.readFile(getShortcutsStorePathV1(), 'utf-8')
    const parsedValue = JSON.parse(rawValue) as StoredShortcutOverridesV1
    return {
      overrides: sanitizeV1Overrides(parsedValue),
      needsRewrite: true
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        overrides: {},
        needsRewrite: false
      }
    }

    console.warn('Failed to read legacy shortcuts configuration, using defaults.', error)
    return {
      overrides: {},
      needsRewrite: false
    }
  }
}

export async function loadShortcutOverrides(): Promise<LoadShortcutOverridesResult> {
  try {
    const rawValue = await fs.readFile(getShortcutsStorePathV2(), 'utf-8')
    const parsedValue = JSON.parse(rawValue) as StoredShortcutOverridesV2

    if (!parsedValue || typeof parsedValue !== 'object' || parsedValue.version !== 2) {
      return {
        overrides: {},
        needsRewrite: true
      }
    }

    return {
      overrides: sanitizeV2Overrides(parsedValue),
      needsRewrite: false
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return loadFromV1Store()
    }

    console.warn('Failed to read shortcuts configuration, using defaults.', error)

    return {
      overrides: {},
      needsRewrite: true
    }
  }
}

export async function saveShortcutOverrides(overrides: ShortcutOverrides): Promise<void> {
  const storedOverrides = toStoredOverridesV2(overrides)
  const filePath = getShortcutsStorePathV2()
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(storedOverrides, null, 2), 'utf-8')
}
