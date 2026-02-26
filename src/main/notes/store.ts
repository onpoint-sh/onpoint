import { app } from 'electron'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import type { NotesConfig } from '../../shared/notes'
import { loadNotesConfigFromPath, saveNotesConfigToPath } from './config'

const NOTES_STORE_FILE_NAME = 'notes.v1.json'

function getNotesStorePath(windowId: string): string {
  // The "main" window uses the original filename for migration compatibility
  if (windowId === 'main') {
    return join(app.getPath('userData'), NOTES_STORE_FILE_NAME)
  }
  return join(app.getPath('userData'), `notes.${windowId}.v1.json`)
}

export async function loadNotesConfig(windowId: string): Promise<NotesConfig> {
  return loadNotesConfigFromPath(getNotesStorePath(windowId))
}

export async function saveNotesConfig(windowId: string, config: NotesConfig): Promise<void> {
  return saveNotesConfigToPath(getNotesStorePath(windowId), config)
}

export async function copyNotesConfig(fromWindowId: string, toWindowId: string): Promise<void> {
  const config = await loadNotesConfig(fromWindowId)
  await saveNotesConfig(toWindowId, config)
}

export async function deleteNotesConfig(windowId: string): Promise<void> {
  if (windowId === 'main') return
  try {
    await fs.unlink(getNotesStorePath(windowId))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Failed to delete notes config for window ${windowId}`, error)
    }
  }
}
