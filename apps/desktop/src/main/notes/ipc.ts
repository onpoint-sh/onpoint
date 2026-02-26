import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions
} from 'electron'
import {
  NOTES_IPC_CHANNELS,
  type ArchiveNoteResult,
  type CreateFolderResult,
  type CreateNoteInput,
  type DeleteNoteResult,
  type MoveNoteResult,
  type NoteDocument,
  type NotesConfig,
  type NoteSummary,
  type RenameFolderResult,
  type RenameNoteResult,
  type SaveNoteResult
} from '@onpoint/shared/notes'
import {
  archiveVaultNote,
  createVaultFolder,
  createVaultNote,
  deleteVaultNote,
  ensureVaultPath,
  listVaultNotes,
  moveVaultNote,
  openVaultNote,
  renameVaultFolder,
  renameVaultNote,
  saveVaultNote
} from './files'
import { loadNotesConfig, saveNotesConfig } from './store'
import { windowRegistry } from '../window/window-registry'

function removeNotesHandlers(): void {
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.getConfig)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.pickVault)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.setVault)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.list)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.open)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.create)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.save)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.rename)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.delete)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.archive)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.move)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.createFolder)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.renameFolder)
}

function getWindowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function resolveWindowId(event: IpcMainInvokeEvent): string {
  const window = getWindowFromEvent(event)
  if (!window) return 'main'
  return windowRegistry.getWindowId(window) ?? 'main'
}

async function ensureConfiguredVaultPath(windowId: string): Promise<string> {
  const config = await loadNotesConfig(windowId)

  if (!config.vaultPath) {
    throw new Error('No vault selected. Choose a notes folder first.')
  }

  return ensureVaultPath(config.vaultPath)
}

function mergeConfig(config: NotesConfig, updates: Partial<NotesConfig>): NotesConfig {
  return {
    vaultPath: updates.vaultPath !== undefined ? updates.vaultPath : config.vaultPath,
    lastOpenedRelativePath:
      updates.lastOpenedRelativePath !== undefined
        ? updates.lastOpenedRelativePath
        : config.lastOpenedRelativePath
  }
}

async function setVaultConfig(windowId: string, vaultPath: string): Promise<NotesConfig> {
  const nextVaultPath = await ensureVaultPath(vaultPath)
  const currentConfig = await loadNotesConfig(windowId)

  const nextConfig = mergeConfig(currentConfig, {
    vaultPath: nextVaultPath,
    lastOpenedRelativePath:
      currentConfig.vaultPath === nextVaultPath ? currentConfig.lastOpenedRelativePath : null
  })

  await saveNotesConfig(windowId, nextConfig)
  return nextConfig
}

async function getConfig(windowId: string): Promise<NotesConfig> {
  const config = await loadNotesConfig(windowId)

  if (!config.vaultPath) {
    return config
  }

  try {
    const resolvedVaultPath = await ensureVaultPath(config.vaultPath)

    if (resolvedVaultPath === config.vaultPath) {
      return config
    }

    const nextConfig = mergeConfig(config, { vaultPath: resolvedVaultPath })
    await saveNotesConfig(windowId, nextConfig)
    return nextConfig
  } catch {
    const resetConfig = mergeConfig(config, {
      vaultPath: null,
      lastOpenedRelativePath: null
    })

    await saveNotesConfig(windowId, resetConfig)
    return resetConfig
  }
}

async function pickVault(event: IpcMainInvokeEvent, windowId: string): Promise<string | null> {
  const window = getWindowFromEvent(event)

  const dialogOptions: OpenDialogOptions = {
    title: 'Select Notes Folder',
    properties: ['openDirectory', 'createDirectory']
  }

  const result = window
    ? await dialog.showOpenDialog(window, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)

  if (result.canceled) {
    return null
  }

  const selectedVaultPath = result.filePaths[0]

  if (!selectedVaultPath) {
    return null
  }

  const nextConfig = await setVaultConfig(windowId, selectedVaultPath)
  return nextConfig.vaultPath
}

async function listNotes(windowId: string): Promise<NoteSummary[]> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  return listVaultNotes(vaultPath)
}

async function openNote(windowId: string, relativePath: string): Promise<NoteDocument> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const note = await openVaultNote(vaultPath, relativePath)
  const config = await loadNotesConfig(windowId)

  await saveNotesConfig(
    windowId,
    mergeConfig(config, {
      lastOpenedRelativePath: note.relativePath
    })
  )

  return note
}

async function createNote(
  windowId: string,
  input?: CreateNoteInput,
  parentRelativePath?: string
): Promise<NoteDocument> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const note = await createVaultNote(vaultPath, input, parentRelativePath)
  const config = await loadNotesConfig(windowId)

  await saveNotesConfig(
    windowId,
    mergeConfig(config, {
      lastOpenedRelativePath: note.relativePath
    })
  )

  return note
}

async function saveNote(
  windowId: string,
  relativePath: string,
  content: string
): Promise<SaveNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const saveResult = await saveVaultNote(vaultPath, relativePath, content)
  const config = await loadNotesConfig(windowId)

  await saveNotesConfig(
    windowId,
    mergeConfig(config, {
      lastOpenedRelativePath: relativePath
    })
  )

  return saveResult
}

async function renameNote(
  windowId: string,
  relativePath: string,
  requestedTitle: string
): Promise<RenameNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const renameResult = await renameVaultNote(vaultPath, relativePath, requestedTitle)
  const config = await loadNotesConfig(windowId)

  await saveNotesConfig(
    windowId,
    mergeConfig(config, {
      lastOpenedRelativePath: renameResult.relativePath
    })
  )

  return renameResult
}

async function deleteNote(windowId: string, relativePath: string): Promise<DeleteNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const result = await deleteVaultNote(vaultPath, relativePath)
  const config = await loadNotesConfig(windowId)

  if (config.lastOpenedRelativePath === relativePath) {
    await saveNotesConfig(windowId, mergeConfig(config, { lastOpenedRelativePath: null }))
  }

  return result
}

async function archiveNote(windowId: string, relativePath: string): Promise<ArchiveNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const result = await archiveVaultNote(vaultPath, relativePath)
  const config = await loadNotesConfig(windowId)

  if (config.lastOpenedRelativePath === relativePath) {
    await saveNotesConfig(windowId, mergeConfig(config, { lastOpenedRelativePath: null }))
  }

  return result
}

async function moveNote(
  windowId: string,
  fromRelativePath: string,
  toRelativePath: string
): Promise<MoveNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const result = await moveVaultNote(vaultPath, fromRelativePath, toRelativePath)
  const config = await loadNotesConfig(windowId)

  if (config.lastOpenedRelativePath === fromRelativePath) {
    await saveNotesConfig(
      windowId,
      mergeConfig(config, { lastOpenedRelativePath: result.relativePath })
    )
  }

  return result
}

async function createFolder(windowId: string, relativePath: string): Promise<CreateFolderResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  return createVaultFolder(vaultPath, relativePath)
}

async function renameFolder(
  windowId: string,
  fromRelativePath: string,
  toRelativePath: string
): Promise<RenameFolderResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  return renameVaultFolder(vaultPath, fromRelativePath, toRelativePath)
}

export function registerNotesIpc(): () => void {
  removeNotesHandlers()

  ipcMain.handle(NOTES_IPC_CHANNELS.getConfig, (event) => {
    return getConfig(resolveWindowId(event))
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.pickVault, (event) => {
    const windowId = resolveWindowId(event)
    return pickVault(event, windowId)
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.setVault, (event, vaultPath: string) => {
    return setVaultConfig(resolveWindowId(event), vaultPath)
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.list, (event) => {
    return listNotes(resolveWindowId(event))
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.open, (event, relativePath: string) => {
    return openNote(resolveWindowId(event), relativePath)
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.create,
    (event, input?: CreateNoteInput, parentRelativePath?: string) => {
      return createNote(resolveWindowId(event), input, parentRelativePath)
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.save, (event, relativePath: string, content: string) => {
    return saveNote(resolveWindowId(event), relativePath, content)
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.rename,
    (event, relativePath: string, requestedTitle: string) => {
      return renameNote(resolveWindowId(event), relativePath, requestedTitle)
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.delete, (event, relativePath: string) => {
    return deleteNote(resolveWindowId(event), relativePath)
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.archive, (event, relativePath: string) => {
    return archiveNote(resolveWindowId(event), relativePath)
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.move,
    (event, fromRelativePath: string, toRelativePath: string) => {
      return moveNote(resolveWindowId(event), fromRelativePath, toRelativePath)
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.createFolder, (event, relativePath: string) => {
    return createFolder(resolveWindowId(event), relativePath)
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.renameFolder,
    (event, fromRelativePath: string, toRelativePath: string) => {
      return renameFolder(resolveWindowId(event), fromRelativePath, toRelativePath)
    }
  )

  return () => {
    removeNotesHandlers()
  }
}
