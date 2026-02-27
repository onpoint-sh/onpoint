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
import { shell } from 'electron'
import type {
  ArchiveNoteResult,
  CreateFolderResult,
  CreateNoteInput,
  DeleteNoteResult,
  MoveNoteResult,
  NoteDocument,
  NoteSummary,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteResult,
  SearchContentMatch
} from '@onpoint/shared/notes'
import {
  buildNoteContent,
  extractBody,
  extractTitle,
  migrateFromHeading,
  replaceFrontmatterTitle
} from '@onpoint/shared/frontmatter'

type BodyCacheEntry = {
  body: string
  title: string
  mtimeMs: number
}

// Per-vault body cache: keyed by resolved vault path → (relativePath → entry)
const vaultBodyCaches = new Map<string, Map<string, BodyCacheEntry>>()

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/')
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function sanitizeRelativePath(relativePath: string): string {
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

  return segments.join('/')
}

function ensureMarkdownFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith('.md') ? fileName : `${fileName}.md`
}

function slugifyTitle(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeNoteTitle(requestedTitle: string): string {
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
function extractTitleFromContent(content: string): string | null {
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

function toNoteSummary(
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

async function walkMarkdownFiles(vaultPath: string, directoryPath: string): Promise<NoteSummary[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const files: NoteSummary[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === '.obsidian') continue

    const absolutePath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      const nestedFiles = await walkMarkdownFiles(vaultPath, absolutePath)
      files.push(...nestedFiles)
      continue
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue

    const [content, fileStats] = await Promise.all([
      fs.readFile(absolutePath, 'utf-8'),
      fs.stat(absolutePath)
    ])
    const summary = toNoteSummary(vaultPath, absolutePath, content, fileStats.mtimeMs, fileStats.size)
    files.push(summary)

    // Populate body cache (piggyback on existing I/O)
    const vaultCache = vaultBodyCaches.get(vaultPath)
    if (vaultCache) {
      vaultCache.set(summary.relativePath, {
        body: extractBody(content),
        title: summary.title,
        mtimeMs: summary.mtimeMs
      })
    }
  }

  return files
}

export async function listVaultNotes(vaultPath: string): Promise<NoteSummary[]> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)

  // Reset body cache before full walk — ensures a complete snapshot
  vaultBodyCaches.set(resolvedVaultPath, new Map())

  const notes = await walkMarkdownFiles(resolvedVaultPath, resolvedVaultPath)

  notes.sort((left, right) => {
    return right.mtimeMs - left.mtimeMs
  })

  return notes
}

function resolveNotePath(vaultPath: string, relativePath: string): string {
  const sanitizedRelativePath = sanitizeRelativePath(relativePath)
  const absolutePath = resolve(vaultPath, sanitizedRelativePath)

  if (!isPathInsideRoot(vaultPath, absolutePath)) {
    throw new Error('Invalid note path.')
  }

  return absolutePath
}

export async function openVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<NoteDocument> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const absolutePath = resolveNotePath(resolvedVaultPath, relativePath)
  const [rawContent, fileStats] = await Promise.all([
    fs.readFile(absolutePath, 'utf-8'),
    fs.stat(absolutePath)
  ])

  const content = migrateFromHeading(
    rawContent,
    new Date(fileStats.birthtimeMs).toISOString()
  )

  return {
    relativePath: sanitizeRelativePath(relativePath),
    content,
    mtimeMs: fileStats.mtimeMs
  }
}

async function buildUniqueFilePath(
  parentPath: string,
  input?: CreateNoteInput
): Promise<string> {
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
  const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`

  await fs.writeFile(tempPath, content, 'utf-8')
  await fs.rename(tempPath, absolutePath)

  const fileStats = await fs.stat(absolutePath)

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
  const title = normalizeNoteTitle(requestedTitle)
  const currentContent = await fs.readFile(absolutePath, 'utf-8')
  const migrated = migrateFromHeading(currentContent)
  const nextContent = replaceFrontmatterTitle(migrated, title)
  const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`

  await fs.writeFile(tempPath, nextContent, 'utf-8')
  await fs.rename(tempPath, absolutePath)

  const nextRelativePath = toPosixPath(relative(resolvedVaultPath, absolutePath))
  const fileStats = await fs.stat(absolutePath)

  return {
    relativePath: nextRelativePath,
    content: nextContent,
    mtimeMs: fileStats.mtimeMs
  }
}

export async function deleteVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<DeleteNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const absolutePath = resolveNotePath(resolvedVaultPath, relativePath)

  await fs.stat(absolutePath)
  await shell.trashItem(absolutePath)

  return { deletedPath: sanitizeRelativePath(relativePath) }
}

export async function archiveVaultNote(
  vaultPath: string,
  relativePath: string
): Promise<ArchiveNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const sanitizedPath = sanitizeRelativePath(relativePath)
  const absolutePath = resolveNotePath(resolvedVaultPath, sanitizedPath)

  await fs.stat(absolutePath)

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
  await fs.rename(absolutePath, archiveDest)

  const archivedTo = toPosixPath(relative(resolvedVaultPath, archiveDest))
  return { archivedTo }
}

export async function moveVaultNote(
  vaultPath: string,
  fromRelativePath: string,
  toRelativePath: string
): Promise<MoveNoteResult> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const fromAbsolute = resolveNotePath(resolvedVaultPath, fromRelativePath)
  const toSanitized = sanitizeRelativePath(toRelativePath)
  const toAbsolute = resolve(resolvedVaultPath, toSanitized)

  if (!isPathInsideRoot(resolvedVaultPath, toAbsolute)) {
    throw new Error('Invalid destination path.')
  }

  await fs.stat(fromAbsolute)
  await fs.mkdir(dirname(toAbsolute), { recursive: true })
  await fs.rename(fromAbsolute, toAbsolute)

  const fileStats = await fs.stat(toAbsolute)
  return {
    relativePath: toPosixPath(relative(resolvedVaultPath, toAbsolute)),
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

  await fs.mkdir(absolutePath, { recursive: true })
  return { relativePath: toPosixPath(relative(resolvedVaultPath, absolutePath)) }
}

function buildSnippet(body: string, index: number, queryLength: number): string {
  const snippetStart = Math.max(0, index - 40)
  const snippetEnd = Math.min(body.length, index + queryLength + 80)
  let snippet = body.slice(snippetStart, snippetEnd).replace(/\n+/g, ' ').trim()
  if (snippetStart > 0) snippet = '...' + snippet
  if (snippetEnd < body.length) snippet = snippet + '...'
  return snippet
}

export async function searchVaultContent(
  vaultPath: string,
  query: string,
  maxResults = 20
): Promise<SearchContentMatch[]> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
  const lowerQuery = query.toLowerCase()
  const matches: SearchContentMatch[] = []

  // Fast path: use in-memory cache populated by listVaultNotes
  const vaultCache = vaultBodyCaches.get(resolvedVaultPath)
  if (vaultCache && vaultCache.size > 0) {
    for (const [relativePath, entry] of vaultCache) {
      if (matches.length >= maxResults) break
      const index = entry.body.toLowerCase().indexOf(lowerQuery)
      if (index === -1) continue
      matches.push({
        relativePath,
        title: entry.title,
        snippet: buildSnippet(entry.body, index, query.length),
        mtimeMs: entry.mtimeMs
      })
    }
    return matches
  }

  // Fallback: read from disk (only before first listVaultNotes completes)
  const notes = await walkMarkdownFiles(resolvedVaultPath, resolvedVaultPath)
  for (const note of notes) {
    if (matches.length >= maxResults) break
    const absolutePath = resolve(resolvedVaultPath, note.relativePath)
    const raw = await fs.readFile(absolutePath, 'utf-8')
    const body = extractBody(raw)
    const index = body.toLowerCase().indexOf(lowerQuery)
    if (index === -1) continue
    matches.push({
      relativePath: note.relativePath,
      title: note.title,
      snippet: buildSnippet(body, index, query.length),
      mtimeMs: note.mtimeMs
    })
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

  await fs.mkdir(dirname(toAbsolute), { recursive: true })
  await fs.rename(fromAbsolute, toAbsolute)

  return { relativePath: toPosixPath(relative(resolvedVaultPath, toAbsolute)) }
}
