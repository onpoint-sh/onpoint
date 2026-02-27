import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { NotesConfig } from '@onpoint/shared/notes'

type StoredNotesConfig = {
  version: 1
  vaultPath: string | null
  lastOpenedRelativePath: string | null
}

export const DEFAULT_NOTES_CONFIG: NotesConfig = {
  vaultPath: null,
  lastOpenedRelativePath: null
}

function sanitizeStoredNotesConfig(value: unknown): NotesConfig {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_NOTES_CONFIG }
  }

  const candidate = value as Partial<StoredNotesConfig>

  return {
    vaultPath:
      typeof candidate.vaultPath === 'string' && candidate.vaultPath.length > 0
        ? candidate.vaultPath
        : null,
    lastOpenedRelativePath:
      typeof candidate.lastOpenedRelativePath === 'string' &&
      candidate.lastOpenedRelativePath.length > 0
        ? candidate.lastOpenedRelativePath
        : null
  }
}

function toStoredNotesConfig(config: NotesConfig): StoredNotesConfig {
  return {
    version: 1,
    vaultPath: config.vaultPath,
    lastOpenedRelativePath: config.lastOpenedRelativePath
  }
}

export async function loadNotesConfigFromPath(filePath: string): Promise<NotesConfig> {
  try {
    const rawValue = await fs.readFile(filePath, 'utf-8')
    const parsedValue = JSON.parse(rawValue) as unknown
    return sanitizeStoredNotesConfig(parsedValue)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_NOTES_CONFIG }
    }

    console.warn('Failed to read notes configuration, using defaults.', error)
    return { ...DEFAULT_NOTES_CONFIG }
  }
}

export async function saveNotesConfigToPath(filePath: string, config: NotesConfig): Promise<void> {
  const storedConfig = toStoredNotesConfig(config)
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(storedConfig, null, 2), 'utf-8')
}
