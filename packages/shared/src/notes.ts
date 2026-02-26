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

export const NOTES_IPC_CHANNELS = {
  getConfig: 'notes:get-config',
  pickVault: 'notes:pick-vault',
  setVault: 'notes:set-vault',
  list: 'notes:list',
  open: 'notes:open',
  create: 'notes:create',
  save: 'notes:save',
  rename: 'notes:rename',
  delete: 'notes:delete',
  archive: 'notes:archive',
  move: 'notes:move',
  createFolder: 'notes:create-folder',
  renameFolder: 'notes:rename-folder'
} as const
