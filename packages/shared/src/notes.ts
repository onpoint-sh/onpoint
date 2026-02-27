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

export type SearchContentMatch = {
  relativePath: string
  title: string
  snippet: string
  mtimeMs: number
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
  archive: 'notes:archive',
  move: 'notes:move',
  createFolder: 'notes:create-folder',
  renameFolder: 'notes:rename-folder',
  searchContent: 'notes:search-content'
} as const
