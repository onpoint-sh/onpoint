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
  SaveNoteResult
} from '@onpoint/shared/notes'
import {
  buildNoteContent,
  extractTitle,
  migrateFromHeading,
  replaceFrontmatterTitle
} from '@onpoint/shared/frontmatter'

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
    files.push(toNoteSummary(vaultPath, absolutePath, content, fileStats.mtimeMs, fileStats.size))
  }

  return files
}

export async function listVaultNotes(vaultPath: string): Promise<NoteSummary[]> {
  const resolvedVaultPath = await ensureVaultPath(vaultPath)
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
