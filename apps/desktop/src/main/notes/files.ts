import { shell } from 'electron'
import {
  deleteVaultFolder as coreDeleteVaultFolder,
  deleteVaultNote as coreDeleteVaultNote
} from '@onpoint/notes-core/vault-files'
import type { DeleteFolderResult, DeleteNoteResult } from '@onpoint/shared/notes'

export {
  archiveVaultNote,
  buildTimestampFileName,
  createVaultFolder,
  createVaultNote,
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
} from '@onpoint/notes-core/vault-files'

export async function deleteVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<DeleteNoteResult> {
  return coreDeleteVaultNote(vaultPath, relativePath, (path) => shell.trashItem(path))
}

export async function deleteVaultFolder(
  vaultPath: string,
  relativePath: string
): Promise<DeleteFolderResult> {
  return coreDeleteVaultFolder(vaultPath, relativePath, (path) => shell.trashItem(path))
}
