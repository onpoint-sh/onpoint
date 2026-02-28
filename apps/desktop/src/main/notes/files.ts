import { shell } from 'electron'
import { deleteVaultNote as coreDeleteVaultNote } from '@onpoint/notes-core/vault-files'
import type { DeleteNoteResult } from '@onpoint/shared/notes'

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
  searchVaultContent
} from '@onpoint/notes-core/vault-files'

export async function deleteVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<DeleteNoteResult> {
  return coreDeleteVaultNote(vaultPath, relativePath, (path) => shell.trashItem(path))
}
