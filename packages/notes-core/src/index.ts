export {
  type DeleteStrategy,
  type NoteSortField,
  type SearchContentOptions,
  toPosixPath,
  isPathInsideRoot,
  sanitizeRelativePath,
  ensureMarkdownFileName,
  slugifyTitle,
  normalizeNoteTitle,
  extractTitleFromContent,
  buildTimestampFileName,
  ensureVaultPath,
  toNoteSummary,
  listVaultNotes,
  listVaultFolders,
  sortNotes,
  resolveNotePath,
  openVaultNote,
  createVaultNote,
  saveVaultNote,
  renameVaultNote,
  deleteVaultNote,
  archiveVaultNote,
  moveVaultNote,
  createVaultFolder,
  searchVaultContent,
  renameVaultFolder
} from './vault-files'

export {
  DEFAULT_NOTES_CONFIG,
  loadNotesConfigFromPath,
  saveNotesConfigToPath
} from './vault-config'

export { type FuzzySearchResult, fuzzySearchNotes } from './fuzzy-search'

export { type NoteTreeNode, buildNotesTree } from './notes-tree'

export {
  stripMarkdown,
  extractSection,
  extractSections,
  stripLinks,
  stripCodeBlocks,
  summarize
} from './markdown-strip'
