import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve
} from 'node:path'
import type {
  ArchiveNoteResult,
  CreateFolderResult,
  CreateNoteInput,
  DeleteFolderResult,
  DeleteNoteResult,
  MoveNoteResult,
  NoteDocument,
  OpenBufferSnapshot,
  NoteSummary,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteResult,
  SearchContentMatch,
  SearchQueryOptions
} from '@onpoint/shared/notes'
import {
  buildNoteContent,
  extractBody,
  extractTitle,
  migrateFromHeading,
  replaceFrontmatterTitle
} from '@onpoint/shared/frontmatter'
import {
  stripCodeBlocks as doStripCodeBlocks,
  stripMarkdown as doStripMarkdown
} from './markdown-strip'
import {
  searchVaultContentV2 as searchVaultContentV2Core,
  searchVaultTitlesV2 as searchVaultTitlesV2Core
} from './search-engine'
import { isValidBasename } from './file-name-validation'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function escapeMessageName(name: string): string {
  return name.replace(/\*/g, '\\*')
}

function formatAlreadyExistsError(name: string): string {
  return `A file or folder "${escapeMessageName(name)}" already exists at this location. Please choose a different name.`
}

function formatInvalidNameError(name: string): string {
  return `The name "${escapeMessageName(name)}" is not valid as a file or folder name. Please choose a different name.`
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export type DeleteStrategy = (absolutePath: string) => Promise<void>

type BodyCacheEntry = {
  body: string
  title: string
  mtimeMs: number
}

// Per-vault body cache: keyed by resolved vault path → (relativePath → entry)
const vaultBodyCaches = new Map<string, Map<string, BodyCacheEntry>>()

function invalidateCacheEntry(vaultPath: string, relativePath: string): void {
  vaultBodyCaches.get(vaultPath)?.delete(relativePath)
}

function upsertCacheEntry(
  vaultPath: string,
  relativePath: string,
  content: string,
  mtimeMs: number
): void {
  const vaultCache = vaultBodyCaches.get(vaultPath)
  if (!vaultCache) return

  const isMdFile = relativePath.toLowerCase().endsWith('.md')
  const title = extractTitleFromContent(content) ?? basename(relativePath, extname(relativePath))
  vaultCache.set(relativePath, {
    body: isMdFile ? extractBody(content) : content,
    title,
    mtimeMs
  })
}

function moveCacheEntry(vaultPath: string, fromRelativePath: string, toRelativePath: string): void {
  const vaultCache = vaultBodyCaches.get(vaultPath)
  if (!vaultCache) return

  const existing = vaultCache.get(fromRelativePath)
  if (!existing) return

  vaultCache.delete(fromRelativePath)
  vaultCache.set(toRelativePath, existing)
}

function invalidateVaultCache(vaultPath: string): void {
  vaultBodyCaches.delete(vaultPath)
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/')
}

export function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

export function sanitizeRelativePath(relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error('Invalid note path.')
  }

  const normalizedPath = toPosixPath(normalize(relativePath))

  if (normalizedPath.startsWith('/') || normalizedPath.includes('\0')) {
    throw new Error('Invalid note path.')
  }

  const segments = normalizedPath.split('/')

  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error('Invalid note path.')
  }

  const isWindows = process.platform === 'win32'
  if (segments.some((segment) => !isValidBasename(segment, isWindows))) {
    throw new Error(formatInvalidNameError(normalizedPath))
  }

  return segments.join('/')
}

export function ensureMarkdownFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith('.md') ? fileName : `${fileName}.md`
}

export function slugifyTitle(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeNoteTitle(requestedTitle: string): string {
  if (typeof requestedTitle !== 'string') {
    throw new Error('Note title is required.')
  }

  const normalizedTitle = requestedTitle.replace(/\r?\n+/g, ' ').trim()

  if (normalizedTitle.length === 0) {
    throw new Error('Note title cannot be empty.')
  }

  return normalizedTitle
}

/**
 * Extracts title from frontmatter, falls back to legacy # heading for unmigrated notes.
 */
export function extractTitleFromContent(content: string): string | null {
  const fmTitle = extractTitle(content)
  if (fmTitle) return fmTitle

  // Legacy fallback for notes not yet migrated to frontmatter
  const headingMatch = content.match(/^\s*#(?!#)\s+(.+?)\s*$/m)
  return headingMatch ? headingMatch[1].trim() || null : null
}

export function buildTimestampFileName(date: Date, suffix = 0): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const base = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`

  if (suffix === 0) {
    return `${base}.md`
  }

  return `${base}-${String(suffix).padStart(2, '0')}.md`
}

export async function ensureVaultPath(vaultPath: string): Promise<string> {
  if (typeof vaultPath !== 'string' || vaultPath.trim().length === 0) {
    throw new Error('Vault path is required.')
  }

  const resolvedVaultPath = resolve(vaultPath)
  const stats = await fs.stat(resolvedVaultPath)

  if (!stats.isDirectory()) {
    throw new Error('Vault path must be a directory.')
  }

  return resolvedVaultPath
}

export function toNoteSummary(
  vaultPath: string,
  absolutePath: string,
  content: string,
  mtimeMs: number,
  size: number
): NoteSummary {
  const relativePath = toPosixPath(relative(vaultPath, absolutePath))
  const fallbackTitle = basename(relativePath, extname(relativePath))
  const title = extractTitleFromContent(content) ?? fallbackTitle

  return {
    relativePath,
    title,
    mtimeMs,
    size
  }
}

async function walkVaultFiles(vaultPath: string, directoryPath: string): Promise<NoteSummary[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const files: NoteSummary[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === '.obsidian') continue
    if (entry.isSymbolicLink()) continue

    const absolutePath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      const nestedFiles = await walkVaultFiles(vaultPath, absolutePath)
      files.push(...nestedFiles)
      continue
    }

    if (!entry.isFile()) continue

    let content: string
    try {
      content = await fs.readFile(absolutePath, 'utf-8')
    } catch {
      continue
    }
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE_BYTES) continue
    const fileStats = await fs.stat(absolutePath)
    const summary = toNoteSummary(
      vaultPath,
      absolutePath,
      content,
      fileStats.mtimeMs,
      fileStats.size
    )
    files.push(summary)

    // Populate body cache (piggyback on existing I/O)
    const vaultCache = vaultBodyCaches.get(vaultPath)
    if (vaultCache) upsertCacheEntry(vaultPath, summary.relativePath, content, summary.mtimeMs)
  }

  return files
}

async function walkDirectories(vaultPath: string, directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const folders: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === '.obsidian') continue
    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      const absolutePath = join(directoryPath, entry.name)
      folders.push(toPosixPath(relative(vaultPath, absolutePath)))
      const nestedFolders = await walkDirectories(vaultPath, absolutePath)
      folders.push(...nestedFolders)
    }
  }

  return folders
}

export async function listVaultFolders(vaultPath: string): Promise<string[]> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  return walkDirectories(resolvedVaultPath, resolvedVaultPath)
}

export async function listVaultNotes(vaultPath: string): Promise<NoteSummary[]> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)

  // Reset body cache before full walk — ensures a complete snapshot
  vaultBodyCaches.set(resolvedVaultPath, new Map())

  const notes = await walkVaultFiles(resolvedVaultPath, resolvedVaultPath)

  notes.sort((left, right) => {
    return right.mtimeMs - left.mtimeMs
  })

  return notes
}

export function resolveNotePath(vaultPath: string, relativePath: string): string {
  const sanitizedRelativePath = sanitizeRelativePath(relativePath)
  const absolutePath = resolve(vaultPath, sanitizedRelativePath)

  if (!isPathInsideRoot(vaultPath, absolutePath)) {
    throw new Error('Invalid note path.')
  }

  return absolutePath
}

async function assertRealPathInsideVault(absolutePath: string, vaultPath: string): Promise<void> {
  const realPath = await fs.realpath(absolutePath)
  if (!isPathInsideRoot(vaultPath, realPath)) {
    throw new Error('Invalid note path.')
  }
}

async function assertParentRealPathInsideVault(
  absolutePath: string,
  vaultPath: string
): Promise<void> {
  const parentDir = dirname(absolutePath)
  const realParent = await fs.realpath(parentDir)
  if (realParent !== vaultPath && !isPathInsideRoot(vaultPath, realParent)) {
    throw new Error('Invalid note path.')
  }
}

export async function openVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<NoteDocument> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const absolutePath = resolveNotePath(resolvedVaultPath, relativePath)
  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)
  const rawContent = await fs.readFile(absolutePath, 'utf-8')
  if (Buffer.byteLength(rawContent, 'utf-8') > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`)
  }
  const fileStats = await fs.stat(absolutePath)

  const isMd = relativePath.toLowerCase().endsWith('.md')
  const content = isMd
    ? migrateFromHeading(rawContent, new Date(fileStats.birthtimeMs).toISOString())
    : rawContent

  return {
    relativePath: sanitizeRelativePath(relativePath),
    content,
    mtimeMs: fileStats.mtimeMs
  }
}

async function buildUniqueFilePath(parentPath: string, input?: CreateNoteInput): Promise<string> {
  const slug = input?.requestedTitle ? slugifyTitle(input.requestedTitle) : ''

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const timestampName = buildTimestampFileName(new Date(), suffix)
    const fileName =
      slug.length > 0
        ? ensureMarkdownFileName(`${timestampName.slice(0, -3)}-${slug}`)
        : timestampName
    const absolutePath = join(parentPath, fileName)

    try {
      await fs.access(absolutePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return absolutePath
      }

      throw error
    }
  }

  throw new Error('Failed to allocate a unique note filename.')
}

export async function createVaultNote(
  vaultPath: string,
  input?: CreateNoteInput,
  parentRelativePath?: string
): Promise<NoteDocument> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  let parentAbsolute = resolvedVaultPath

  if (parentRelativePath) {
    const sanitizedParent = sanitizeRelativePath(parentRelativePath)
    parentAbsolute = resolve(resolvedVaultPath, sanitizedParent)

    if (!isPathInsideRoot(resolvedVaultPath, parentAbsolute)) {
      throw new Error('Invalid parent folder path.')
    }

    await fs.mkdir(parentAbsolute, { recursive: true })
    await assertRealPathInsideVault(parentAbsolute, resolvedVaultPath)
  }

  const absolutePath = await buildUniqueFilePath(parentAbsolute, input)
  const relativePath = toPosixPath(relative(resolvedVaultPath, absolutePath))
  const initialTitle = input?.requestedTitle ? normalizeNoteTitle(input.requestedTitle) : null
  const now = new Date().toISOString()
  const initialContent = buildNoteContent({ title: initialTitle, created: now }, '')

  await fs.writeFile(absolutePath, initialContent, 'utf-8')

  return openVaultNote(resolvedVaultPath, relativePath)
}

export async function saveVaultNote(
  vaultPath: string,
  relativePath: string,
  content: string
): Promise<SaveNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const absolutePath = resolveNotePath(resolvedVaultPath, relativePath)
  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)
  const tempPath = `${absolutePath}.${randomUUID()}.tmp`

  await fs.writeFile(tempPath, content, 'utf-8')
  await fs.rename(tempPath, absolutePath)

  const sanitizedRelativePath = sanitizeRelativePath(relativePath)
  const fileStats = await fs.stat(absolutePath)
  upsertCacheEntry(resolvedVaultPath, sanitizedRelativePath, content, fileStats.mtimeMs)

  return {
    mtimeMs: fileStats.mtimeMs
  }
}

export async function renameVaultNote(
  vaultPath: string,
  relativePath: string,
  requestedTitle: string
): Promise<RenameNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const absolutePath = resolveNotePath(resolvedVaultPath, relativePath)
  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)
  const title = normalizeNoteTitle(requestedTitle)
  const currentContent = await fs.readFile(absolutePath, 'utf-8')
  const migrated = migrateFromHeading(currentContent)
  const nextContent = replaceFrontmatterTitle(migrated, title)
  const tempPath = `${absolutePath}.${randomUUID()}.tmp`

  await fs.writeFile(tempPath, nextContent, 'utf-8')
  await fs.rename(tempPath, absolutePath)

  const nextRelativePath = toPosixPath(relative(resolvedVaultPath, absolutePath))
  const fileStats = await fs.stat(absolutePath)
  upsertCacheEntry(resolvedVaultPath, nextRelativePath, nextContent, fileStats.mtimeMs)

  return {
    relativePath: nextRelativePath,
    content: nextContent,
    mtimeMs: fileStats.mtimeMs
  }
}

export async function deleteVaultNote(
  vaultPath: string,
  relativePath: string,
  deleteStrategy?: DeleteStrategy
): Promise<DeleteNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const absolutePath = resolveNotePath(resolvedVaultPath, relativePath)
  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)

  if (deleteStrategy) {
    await deleteStrategy(absolutePath)
  } else {
    await fs.unlink(absolutePath)
  }

  invalidateCacheEntry(resolvedVaultPath, sanitizeRelativePath(relativePath))
  return { deletedPath: sanitizeRelativePath(relativePath) }
}

export async function archiveVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<ArchiveNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const sanitizedPath = sanitizeRelativePath(relativePath)
  const absolutePath = resolveNotePath(resolvedVaultPath, sanitizedPath)
  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)

  const archiveDir = join(resolvedVaultPath, '.archive')
  let archiveDest = join(archiveDir, sanitizedPath)

  try {
    await fs.access(archiveDest)
    const ext = extname(archiveDest)
    const base = archiveDest.slice(0, archiveDest.length - ext.length)
    archiveDest = `${base}-${Date.now()}${ext}`
  } catch {
    // Destination doesn't exist — no conflict
  }

  await fs.mkdir(dirname(archiveDest), { recursive: true })
  await assertParentRealPathInsideVault(archiveDest, resolvedVaultPath)
  await fs.rename(absolutePath, archiveDest)

  const archivedTo = toPosixPath(relative(resolvedVaultPath, archiveDest))
  invalidateCacheEntry(resolvedVaultPath, sanitizedPath)
  return { archivedTo }
}

export async function moveVaultNote(
  vaultPath: string,
  fromRelativePath: string,
  toRelativePath: string
): Promise<MoveNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const sanitizedFromPath = sanitizeRelativePath(fromRelativePath)
  const fromAbsolute = resolveNotePath(resolvedVaultPath, sanitizedFromPath)
  await assertRealPathInsideVault(fromAbsolute, resolvedVaultPath)
  const toSanitized = sanitizeRelativePath(toRelativePath)
  if (toSanitized === sanitizedFromPath) {
    const fileStats = await fs.stat(fromAbsolute)
    return {
      relativePath: sanitizedFromPath,
      mtimeMs: fileStats.mtimeMs
    }
  }
  const toAbsolute = resolve(resolvedVaultPath, toSanitized)

  if (!isPathInsideRoot(resolvedVaultPath, toAbsolute)) {
    throw new Error('Invalid destination path.')
  }

  if (await pathExists(toAbsolute)) {
    throw new Error(formatAlreadyExistsError(toSanitized))
  }

  await fs.mkdir(dirname(toAbsolute), { recursive: true })
  await assertParentRealPathInsideVault(toAbsolute, resolvedVaultPath)
  await fs.rename(fromAbsolute, toAbsolute)

  const nextRelativePath = toPosixPath(relative(resolvedVaultPath, toAbsolute))
  moveCacheEntry(resolvedVaultPath, sanitizedFromPath, nextRelativePath)

  let content: string | null = null
  try {
    content = await fs.readFile(toAbsolute, 'utf-8')
  } catch {
    invalidateCacheEntry(resolvedVaultPath, nextRelativePath)
  }
  const fileStats = await fs.stat(toAbsolute)
  if (content !== null) {
    upsertCacheEntry(resolvedVaultPath, nextRelativePath, content, fileStats.mtimeMs)
  }
  return {
    relativePath: nextRelativePath,
    mtimeMs: fileStats.mtimeMs
  }
}

export async function createVaultFolder(
  vaultPath: string,
  relativePath: string
): Promise<CreateFolderResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const sanitizedPath = sanitizeRelativePath(relativePath)
  const absolutePath = resolve(resolvedVaultPath, sanitizedPath)

  if (!isPathInsideRoot(resolvedVaultPath, absolutePath)) {
    throw new Error('Invalid folder path.')
  }

  if (await pathExists(absolutePath)) {
    throw new Error(formatAlreadyExistsError(sanitizedPath))
  }

  await fs.mkdir(absolutePath, { recursive: true })
  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)
  return { relativePath: toPosixPath(relative(resolvedVaultPath, absolutePath)) }
}

export async function deleteVaultFolder(
  vaultPath: string,
  relativePath: string,
  deleteStrategy?: DeleteStrategy
): Promise<DeleteFolderResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const sanitizedPath = sanitizeRelativePath(relativePath)
  const absolutePath = resolve(resolvedVaultPath, sanitizedPath)

  if (!isPathInsideRoot(resolvedVaultPath, absolutePath)) {
    throw new Error('Invalid folder path.')
  }

  const stats = await fs.stat(absolutePath)
  if (!stats.isDirectory()) {
    throw new Error('Source path is not a directory.')
  }

  await assertRealPathInsideVault(absolutePath, resolvedVaultPath)

  if (deleteStrategy) {
    await deleteStrategy(absolutePath)
  } else {
    await fs.rmdir(absolutePath)
  }

  invalidateVaultCache(resolvedVaultPath)
  return { deletedPath: sanitizedPath }
}

export type NoteSortField = 'mtime' | 'title' | 'path'

export function sortNotes(notes: NoteSummary[], sortBy: NoteSortField = 'mtime'): NoteSummary[] {
  const sorted = [...notes]
  if (sortBy === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title))
  } else if (sortBy === 'path') {
    sorted.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }
  // mtime sorting already done by listVaultNotes
  return sorted
}

export type SearchContentOptions = {
  stripCodeBlocks?: boolean
  stripMarkdown?: boolean
}

export async function searchVaultContentV2(
  vaultPath: string,
  query: string,
  options?: SearchQueryOptions,
  openBuffers?: OpenBufferSnapshot[]
): Promise<SearchContentMatch[]> {
  return searchVaultContentV2Core(vaultPath, query, options, openBuffers)
}

export async function searchVaultTitlesV2(
  vaultPath: string,
  query: string,
  options?: SearchQueryOptions
): Promise<(NoteSummary & { score: number })[]> {
  return searchVaultTitlesV2Core(vaultPath, query, options)
}

export async function searchVaultContent(
  vaultPath: string,
  query: string,
  maxResults = 20,
  options?: SearchContentOptions
): Promise<SearchContentMatch[]> {
  const matches = await searchVaultContentV2Core(vaultPath, query, {
    limit: maxResults
  })

  if (options?.stripCodeBlocks || options?.stripMarkdown) {
    for (const match of matches) {
      if (options.stripCodeBlocks) match.snippet = doStripCodeBlocks(match.snippet)
      if (options.stripMarkdown) match.snippet = doStripMarkdown(match.snippet)
    }
  }

  return matches
}

export async function renameVaultFolder(
  vaultPath: string,
  fromRelativePath: string,
  toRelativePath: string
): Promise<RenameFolderResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const fromSanitized = sanitizeRelativePath(fromRelativePath)
  const toSanitized = sanitizeRelativePath(toRelativePath)
  const fromAbsolute = resolve(resolvedVaultPath, fromSanitized)
  const toAbsolute = resolve(resolvedVaultPath, toSanitized)

  if (fromSanitized === toSanitized) {
    return { relativePath: fromSanitized }
  }

  if (!isPathInsideRoot(resolvedVaultPath, fromAbsolute)) {
    throw new Error('Invalid source folder path.')
  }

  if (!isPathInsideRoot(resolvedVaultPath, toAbsolute)) {
    throw new Error('Invalid destination folder path.')
  }

  const stats = await fs.stat(fromAbsolute)

  if (!stats.isDirectory()) {
    throw new Error('Source path is not a directory.')
  }

  if (await pathExists(toAbsolute)) {
    throw new Error(formatAlreadyExistsError(toSanitized))
  }

  await assertRealPathInsideVault(fromAbsolute, resolvedVaultPath)
  await fs.mkdir(dirname(toAbsolute), { recursive: true })
  await assertParentRealPathInsideVault(toAbsolute, resolvedVaultPath)
  await fs.rename(fromAbsolute, toAbsolute)

  invalidateVaultCache(resolvedVaultPath)
  return { relativePath: toPosixPath(relative(resolvedVaultPath, toAbsolute)) }
}
