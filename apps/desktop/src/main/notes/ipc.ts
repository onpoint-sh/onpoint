import {
  app,
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
  type DeleteFolderResult,
  type DeleteNoteResult,
  type MoveNoteResult,
  type NoteDocument,
  type NotesConfig,
  type NoteSummary,
  type OpenBufferSnapshot,
  type RenameFolderResult,
  type RenameNoteResult,
  type SearchContentMatch,
  type SearchQueryOptions,
  type SaveNoteAsResult,
  type SaveNoteResult
} from '@onpoint/shared/notes'
import {
  archiveVaultNote,
  createVaultFolder,
  createVaultNote,
  deleteVaultFolder,
  deleteVaultNote,
  ensureVaultPath,
  listVaultFolders,
  listVaultNotes,
  moveVaultNote,
  openVaultNote,
  renameVaultFolder,
  renameVaultNote,
  sanitizeRelativePath,
  saveVaultNote,
  searchVaultContentV2,
  searchVaultContent
} from './files'
import { loadNotesConfig, saveNotesConfig } from './store'
import { windowRegistry } from '../window/window-registry'

function validateRelativePath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid note path.')
  return sanitizeRelativePath(value)
}

function validateNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error(`${label} must be a non-empty string.`)
  return value
}

function removeNotesHandlers(): void {
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.getConfig)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.pickVault)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.setVault)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.list)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.open)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.create)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.save)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.saveAs)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.rename)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.delete)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.deleteFolder)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.archive)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.move)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.createFolder)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.renameFolder)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.searchContent)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.searchContentV2)
  ipcMain.removeHandler(NOTES_IPC_CHANNELS.listFolders)
}

function isSearchV2Enabled(): boolean {
  const configured = process.env.SEARCH_V2?.trim().toLowerCase()
  if (configured === '1' || configured === 'true' || configured === 'yes') return true
  if (configured === '0' || configured === 'false' || configured === 'no') return false
  return !app.isPackaged
}

const SEARCH_V2_ENABLED = isSearchV2Enabled()

function getWindowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function resolveWindowId(event: IpcMainInvokeEvent): string {
  const window = getWindowFromEvent(event)
  if (!window) return 'main'
  return windowRegistry.getWindowId(window) ?? 'main'
}

// In-memory config cache: prevents repeated disk reads of a corrupted or
// mid-write config file. Written configs are cached immediately so that
// concurrent IPC calls always see the latest known-good value.
const configCache = new Map<string, NotesConfig>()

async function loadCachedNotesConfig(windowId: string): Promise<NotesConfig> {
  const cached = configCache.get(windowId)
  if (cached) return cached
  const config = await loadNotesConfig(windowId)
  if (config.vaultPath) {
    configCache.set(windowId, config)
  }
  return config
}

function setCachedNotesConfig(windowId: string, config: NotesConfig): void {
  if (config.vaultPath) {
    configCache.set(windowId, config)
  } else {
    configCache.delete(windowId)
  }
}

async function ensureConfiguredVaultPath(windowId: string): Promise<string> {
  const config = await loadCachedNotesConfig(windowId)

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
  const currentConfig = await loadCachedNotesConfig(windowId)

  const nextConfig = mergeConfig(currentConfig, {
    vaultPath: nextVaultPath,
    lastOpenedRelativePath:
      currentConfig.vaultPath === nextVaultPath ? currentConfig.lastOpenedRelativePath : null
  })

  setCachedNotesConfig(windowId, nextConfig)
  await saveNotesConfig(windowId, nextConfig)
  return nextConfig
}

async function getConfig(windowId: string): Promise<NotesConfig> {
  const config = await loadCachedNotesConfig(windowId)

  if (!config.vaultPath) {
    return config
  }

  try {
    const resolvedVaultPath = await ensureVaultPath(config.vaultPath)

    if (resolvedVaultPath === config.vaultPath) {
      setCachedNotesConfig(windowId, config)
      return config
    }

    const nextConfig = mergeConfig(config, { vaultPath: resolvedVaultPath })
    setCachedNotesConfig(windowId, nextConfig)
    await saveNotesConfig(windowId, nextConfig)
    return nextConfig
  } catch {
    const resetConfig = mergeConfig(config, {
      vaultPath: null,
      lastOpenedRelativePath: null
    })

    setCachedNotesConfig(windowId, resetConfig)
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

async function listFolders(windowId: string): Promise<string[]> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  return listVaultFolders(vaultPath)
}

async function openNote(windowId: string, relativePath: string): Promise<NoteDocument> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const note = await openVaultNote(vaultPath, relativePath)
  const config = await loadCachedNotesConfig(windowId)

  const nextConfig = mergeConfig(config, {
    lastOpenedRelativePath: note.relativePath
  })
  setCachedNotesConfig(windowId, nextConfig)
  await saveNotesConfig(windowId, nextConfig)

  return note
}

async function createNote(
  windowId: string,
  input?: CreateNoteInput,
  parentRelativePath?: string
): Promise<NoteDocument> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const note = await createVaultNote(vaultPath, input, parentRelativePath)
  const config = await loadCachedNotesConfig(windowId)

  const nextConfig = mergeConfig(config, {
    lastOpenedRelativePath: note.relativePath
  })
  setCachedNotesConfig(windowId, nextConfig)
  await saveNotesConfig(windowId, nextConfig)

  return note
}

async function saveNote(
  windowId: string,
  relativePath: string,
  content: string
): Promise<SaveNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const saveResult = await saveVaultNote(vaultPath, relativePath, content)
  const config = await loadCachedNotesConfig(windowId)

  const nextConfig = mergeConfig(config, {
    lastOpenedRelativePath: relativePath
  })
  setCachedNotesConfig(windowId, nextConfig)
  await saveNotesConfig(windowId, nextConfig)

  return saveResult
}

async function saveNoteAs(
  event: IpcMainInvokeEvent,
  windowId: string,
  content: string
): Promise<SaveNoteAsResult | null> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const browserWindow = getWindowFromEvent(event)

  const dialogOptions = {
    title: 'Save File',
    defaultPath: vaultPath,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Mermaid', extensions: ['mmd', 'mermaid'] },
      { name: 'JavaScript/TypeScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'YAML', extensions: ['yaml', 'yml'] },
      { name: 'HTML/CSS', extensions: ['html', 'css', 'scss'] },
      { name: 'Python', extensions: ['py'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }

  const result = browserWindow
    ? await dialog.showSaveDialog(browserWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)

  if (result.canceled || !result.filePath) {
    return null
  }

  const { promises: fs } = await import('node:fs')
  const { relative } = await import('node:path')

  const { randomUUID } = await import('node:crypto')
  const { isPathInsideRoot } = await import('@onpoint/notes-core/vault-files')

  const filePath = result.filePath
  if (!isPathInsideRoot(vaultPath, filePath)) {
    throw new Error('File must be saved inside the vault.')
  }

  const tempPath = `${filePath}.${randomUUID()}.tmp`
  await fs.writeFile(tempPath, content, 'utf-8')
  await fs.rename(tempPath, filePath)

  const fileStats = await fs.stat(filePath)
  const relativePath = relative(vaultPath, filePath).replace(/\\/g, '/')

  const config = await loadCachedNotesConfig(windowId)
  const nextConfig = mergeConfig(config, { lastOpenedRelativePath: relativePath })
  setCachedNotesConfig(windowId, nextConfig)
  await saveNotesConfig(windowId, nextConfig)

  return { relativePath, mtimeMs: fileStats.mtimeMs }
}

async function renameNote(
  windowId: string,
  relativePath: string,
  requestedTitle: string
): Promise<RenameNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const renameResult = await renameVaultNote(vaultPath, relativePath, requestedTitle)
  const config = await loadCachedNotesConfig(windowId)

  const nextConfig = mergeConfig(config, {
    lastOpenedRelativePath: renameResult.relativePath
  })
  setCachedNotesConfig(windowId, nextConfig)
  await saveNotesConfig(windowId, nextConfig)

  return renameResult
}

async function deleteNote(windowId: string, relativePath: string): Promise<DeleteNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const result = await deleteVaultNote(vaultPath, relativePath)
  const config = await loadCachedNotesConfig(windowId)

  if (config.lastOpenedRelativePath === relativePath) {
    const nextConfig = mergeConfig(config, { lastOpenedRelativePath: null })
    setCachedNotesConfig(windowId, nextConfig)
    await saveNotesConfig(windowId, nextConfig)
  }

  return result
}

async function deleteFolder(windowId: string, relativePath: string): Promise<DeleteFolderResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const result = await deleteVaultFolder(vaultPath, relativePath)
  const config = await loadCachedNotesConfig(windowId)

  if (
    config.lastOpenedRelativePath &&
    (config.lastOpenedRelativePath === relativePath ||
      config.lastOpenedRelativePath.startsWith(`${relativePath}/`))
  ) {
    const nextConfig = mergeConfig(config, { lastOpenedRelativePath: null })
    setCachedNotesConfig(windowId, nextConfig)
    await saveNotesConfig(windowId, nextConfig)
  }

  return result
}

async function archiveNote(windowId: string, relativePath: string): Promise<ArchiveNoteResult> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)
  const result = await archiveVaultNote(vaultPath, relativePath)
  const config = await loadCachedNotesConfig(windowId)

  if (config.lastOpenedRelativePath === relativePath) {
    const nextConfig = mergeConfig(config, { lastOpenedRelativePath: null })
    setCachedNotesConfig(windowId, nextConfig)
    await saveNotesConfig(windowId, nextConfig)
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
  const config = await loadCachedNotesConfig(windowId)

  if (config.lastOpenedRelativePath === fromRelativePath) {
    const nextConfig = mergeConfig(config, { lastOpenedRelativePath: result.relativePath })
    setCachedNotesConfig(windowId, nextConfig)
    await saveNotesConfig(windowId, nextConfig)
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

async function searchContent(
  windowId: string,
  query: string,
  options?: SearchQueryOptions,
  openBuffers?: OpenBufferSnapshot[]
): Promise<SearchContentMatch[]> {
  const vaultPath = await ensureConfiguredVaultPath(windowId)

  if (!SEARCH_V2_ENABLED) {
    return searchVaultContent(vaultPath, query, options?.limit ?? 20)
  }

  return searchVaultContentV2(vaultPath, query, options, openBuffers)
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
    validateNonEmptyString(vaultPath, 'Vault path')
    if (vaultPath.includes('\0')) throw new Error('Invalid vault path.')
    return setVaultConfig(resolveWindowId(event), vaultPath)
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.list, (event) => {
    return listNotes(resolveWindowId(event))
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.open, (event, relativePath: string) => {
    return openNote(resolveWindowId(event), validateRelativePath(relativePath))
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.create,
    (event, input?: CreateNoteInput, parentRelativePath?: string) => {
      const sanitizedParent = parentRelativePath
        ? validateRelativePath(parentRelativePath)
        : undefined
      return createNote(resolveWindowId(event), input, sanitizedParent)
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.save, (event, relativePath: string, content: string) => {
    return saveNote(resolveWindowId(event), validateRelativePath(relativePath), content)
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.saveAs, (event, content: string) => {
    return saveNoteAs(event, resolveWindowId(event), content)
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.rename,
    (event, relativePath: string, requestedTitle: string) => {
      return renameNote(
        resolveWindowId(event),
        validateRelativePath(relativePath),
        validateNonEmptyString(requestedTitle, 'Title')
      )
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.delete, (event, relativePath: string) => {
    return deleteNote(resolveWindowId(event), validateRelativePath(relativePath))
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.deleteFolder, (event, relativePath: string) => {
    return deleteFolder(resolveWindowId(event), validateRelativePath(relativePath))
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.archive, (event, relativePath: string) => {
    return archiveNote(resolveWindowId(event), validateRelativePath(relativePath))
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.move,
    (event, fromRelativePath: string, toRelativePath: string) => {
      return moveNote(
        resolveWindowId(event),
        validateRelativePath(fromRelativePath),
        validateRelativePath(toRelativePath)
      )
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.createFolder, (event, relativePath: string) => {
    return createFolder(resolveWindowId(event), validateRelativePath(relativePath))
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.renameFolder,
    (event, fromRelativePath: string, toRelativePath: string) => {
      return renameFolder(
        resolveWindowId(event),
        validateRelativePath(fromRelativePath),
        validateRelativePath(toRelativePath)
      )
    }
  )

  ipcMain.handle(NOTES_IPC_CHANNELS.listFolders, (event) => {
    return listFolders(resolveWindowId(event))
  })

  ipcMain.handle(NOTES_IPC_CHANNELS.searchContent, async (event, query: string) => {
    validateNonEmptyString(query, 'Search query')
    return searchContent(resolveWindowId(event), query, { limit: 20 })
  })

  ipcMain.handle(
    NOTES_IPC_CHANNELS.searchContentV2,
    async (
      event,
      query: string,
      options?: SearchQueryOptions,
      openBuffers?: OpenBufferSnapshot[]
    ) => {
      validateNonEmptyString(query, 'Search query')
      return searchContent(resolveWindowId(event), query, options, openBuffers)
    }
  )

  if (SEARCH_V2_ENABLED && process.env.SEARCH_V2_DEBUG === '1') {
    console.info('[notes] Search V2 enabled.')
  }

  return () => {
    removeNotesHandlers()
  }
}
