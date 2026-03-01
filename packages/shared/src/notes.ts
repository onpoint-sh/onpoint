export type NoteSummary = {
  relativePath: string
  title: string
  mtimeMs: number
  size: number
}

export type NoteDocument = {
  relativePath: string
  content: string
  mtimeMs: number
}

export type NotesConfig = {
  vaultPath: string | null
  lastOpenedRelativePath: string | null
}

export type CreateNoteInput = {
  requestedTitle?: string
}

export type SaveNoteResult = {
  mtimeMs: number
}

export type RenameNoteResult = {
  relativePath: string
  content: string
  mtimeMs: number
}

export type DeleteNoteResult = {
  deletedPath: string
}

export type DeleteFolderResult = {
  deletedPath: string
}

export type ArchiveNoteResult = {
  archivedTo: string
}

export type MoveNoteResult = {
  relativePath: string
  mtimeMs: number
}

export type CreateFolderResult = {
  relativePath: string
}

export type RenameFolderResult = {
  relativePath: string
}

export type SaveNoteAsResult = {
  relativePath: string
  mtimeMs: number
}

export const UNTITLED_PREFIX = 'untitled:'

export function isUntitledPath(path: string): boolean {
  return path.startsWith(UNTITLED_PREFIX)
}

export type SearchSource = 'buffer' | 'disk'

export type SearchQueryOptions = {
  limit?: number
  includeGlobs?: string[]
  excludeGlobs?: string[]
  fileTypes?: string[]
  includeIgnored?: boolean
  caseSensitive?: boolean
  regex?: boolean
}

export type OpenBufferSnapshot = {
  relativePath: string
  content: string
  mtimeMs?: number
  isDirty: boolean
  title?: string
}

export type SearchContentMatch = {
  relativePath: string
  title: string
  snippet: string
  mtimeMs: number
  source: SearchSource
  line?: number
  column?: number
}

export const NOTES_IPC_CHANNELS = {
  getConfig: 'notes:get-config',
  pickVault: 'notes:pick-vault',
  setVault: 'notes:set-vault',
  list: 'notes:list',
  open: 'notes:open',
  create: 'notes:create',
  save: 'notes:save',
  saveAs: 'notes:save-as',
  rename: 'notes:rename',
  delete: 'notes:delete',
  deleteFolder: 'notes:delete-folder',
  archive: 'notes:archive',
  move: 'notes:move',
  createFolder: 'notes:create-folder',
  renameFolder: 'notes:rename-folder',
  searchContent: 'notes:search-content',
  searchContentV2: 'notes:search-content-v2',
  listFolders: 'notes:list-folders'
} as const
