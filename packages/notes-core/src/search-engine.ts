import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import type {
  NoteSummary,
  OpenBufferSnapshot,
  SearchContentMatch,
  SearchQueryOptions
} from '@onpoint/shared/notes'
import { extractBody, extractTitle } from '@onpoint/shared/frontmatter'
import {
  compileGlobSet,
  matchesGlobSet,
  readIgnoreRulesForDirectory,
  shouldIgnorePath,
  type IgnoreRule
} from './search-ignore'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const DEFAULT_SEARCH_LIMIT = 20

const FILE_TYPE_ALIASES: Record<string, readonly string[]> = {
  all: ['*'],
  md: ['.md'],
  markdown: ['.md', '.markdown'],
  mmd: ['.mmd', '.mermaid'],
  mermaid: ['.mmd', '.mermaid'],
  js: ['.js', '.mjs', '.cjs'],
  javascript: ['.js', '.mjs', '.cjs', '.jsx'],
  jsx: ['.jsx'],
  ts: ['.ts', '.tsx'],
  typescript: ['.ts', '.tsx'],
  tsx: ['.tsx'],
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  yml: ['.yaml', '.yml'],
  html: ['.html', '.htm'],
  css: ['.css', '.scss', '.sass', '.less'],
  scss: ['.scss'],
  py: ['.py'],
  python: ['.py'],
  txt: ['.txt'],
  text: ['.txt']
}

type QueryMatch = {
  index: number
  length: number
}

type SearchResultWithScore = SearchContentMatch & {
  score: number
}

type TitleSearchMatch = NoteSummary & {
  score: number
}

type NormalizedSearchOptions = {
  limit: number
  includeIgnored: boolean
  caseSensitive: boolean
  regex: boolean
  includeGlobs: ReturnType<typeof compileGlobSet>
  excludeGlobs: ReturnType<typeof compileGlobSet>
  fileExtensions: Set<string> | null
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/')
}

async function ensureVaultDirectory(vaultPath: string): Promise<string> {
  if (typeof vaultPath !== 'string' || vaultPath.trim().length === 0) {
    throw new Error('Vault path is required.')
  }

  const resolvedPath = resolve(vaultPath)
  const stats = await fs.stat(resolvedPath)

  if (!stats.isDirectory()) {
    throw new Error('Vault path must be a directory.')
  }

  return resolvedPath
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SEARCH_LIMIT
  return Math.min(500, Math.max(1, Math.floor(value!)))
}

function normalizeFileTypeToken(rawToken: string): string[] {
  const token = rawToken.trim().toLowerCase()
  if (token.length === 0) return []
  if (token === '*' || token === 'all') return ['*']

  if (token.startsWith('.')) {
    return [token]
  }

  const alias = FILE_TYPE_ALIASES[token]
  if (alias) {
    return [...alias]
  }

  return [`.${token}`]
}

function resolveFileExtensions(fileTypes: string[] | undefined): Set<string> | null {
  if (!fileTypes || fileTypes.length === 0) return null

  const extensions = new Set<string>()

  for (const fileType of fileTypes) {
    for (const token of normalizeFileTypeToken(fileType)) {
      if (token === '*') return null
      extensions.add(token)
    }
  }

  return extensions.size > 0 ? extensions : null
}

function normalizeOptions(options?: SearchQueryOptions): NormalizedSearchOptions {
  return {
    limit: clampLimit(options?.limit),
    includeIgnored: options?.includeIgnored === true,
    caseSensitive: options?.caseSensitive === true,
    regex: options?.regex === true,
    includeGlobs: compileGlobSet(options?.includeGlobs),
    excludeGlobs: compileGlobSet(options?.excludeGlobs),
    fileExtensions: resolveFileExtensions(options?.fileTypes)
  }
}

function isLikelyBinary(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.length, 8_000)
  if (sampleLength === 0) return false

  let suspicious = 0

  for (let i = 0; i < sampleLength; i += 1) {
    const byte = buffer[i]
    if (byte === 0) {
      return true
    }
    const isControl = byte < 7 || (byte > 14 && byte < 32) || byte === 127
    if (isControl) suspicious += 1
  }

  return suspicious / sampleLength > 0.3
}

function buildQueryMatcher(
  query: string,
  options: NormalizedSearchOptions
): { match: (text: string) => QueryMatch | null; regexForRank: RegExp | null } {
  if (!options.regex) {
    if (options.caseSensitive) {
      return {
        match: (text) => {
          const index = text.indexOf(query)
          return index === -1 ? null : { index, length: query.length }
        },
        regexForRank: null
      }
    }

    const loweredQuery = query.toLowerCase()
    return {
      match: (text) => {
        const loweredText = text.toLowerCase()
        const index = loweredText.indexOf(loweredQuery)
        return index === -1 ? null : { index, length: query.length }
      },
      regexForRank: null
    }
  }

  const regexFlags = options.caseSensitive ? 'g' : 'gi'
  let regex: RegExp

  try {
    regex = new RegExp(query, regexFlags)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid regular expression.'
    throw new Error(`Invalid regex query: ${message}`)
  }

  return {
    match: (text) => {
      regex.lastIndex = 0
      const match = regex.exec(text)
      if (!match || match.index < 0) return null
      return {
        index: match.index,
        length: Math.max(1, match[0]?.length ?? 0)
      }
    },
    regexForRank: regex
  }
}

function computeLineColumn(text: string, index: number): { line: number; column: number } {
  let line = 1
  let column = 1

  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }

  return { line, column }
}

function buildSnippet(text: string, index: number, length: number): string {
  const snippetStart = Math.max(0, index - 50)
  const snippetEnd = Math.min(text.length, index + length + 100)
  let snippet = text.slice(snippetStart, snippetEnd).replace(/\n+/g, ' ').trim()

  if (snippetStart > 0) snippet = `...${snippet}`
  if (snippetEnd < text.length) snippet = `${snippet}...`

  return snippet
}

function deriveTitle(relativePath: string, content: string): string {
  const extension = extname(relativePath).toLowerCase()
  const fallbackTitle = basename(relativePath, extension)

  if (extension === '.md') {
    return extractTitle(content) ?? fallbackTitle
  }

  return fallbackTitle
}

function normalizePath(relativePath: string): string {
  return toPosixPath(relativePath).replace(/^\/+/, '')
}

function passesPathFilters(relativePath: string, options: NormalizedSearchOptions): boolean {
  const normalizedPath = normalizePath(relativePath)
  const extension = extname(normalizedPath).toLowerCase()

  if (options.fileExtensions && !options.fileExtensions.has(extension)) {
    return false
  }

  if (options.includeGlobs.length > 0 && !matchesGlobSet(normalizedPath, options.includeGlobs)) {
    return false
  }

  if (options.excludeGlobs.length > 0 && matchesGlobSet(normalizedPath, options.excludeGlobs)) {
    return false
  }

  return true
}

function fuzzyCharMatch(text: string, query: string): boolean {
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti += 1) {
    if (text[ti] === query[qi]) qi += 1
  }
  return qi === query.length
}

function getTitlePathScore(
  title: string,
  relativePath: string,
  query: string,
  options: NormalizedSearchOptions,
  regexForRank: RegExp | null
): number {
  if (options.regex && regexForRank) {
    regexForRank.lastIndex = 0
    const titleMatched = regexForRank.test(title)
    regexForRank.lastIndex = 0
    const pathMatched = regexForRank.test(relativePath)
    return titleMatched || pathMatched ? 250 : 100
  }

  const normalizedTitle = options.caseSensitive ? title : title.toLowerCase()
  const normalizedPath = options.caseSensitive ? relativePath : relativePath.toLowerCase()
  const normalizedQuery = options.caseSensitive ? query : query.toLowerCase()

  if (normalizedTitle === normalizedQuery || normalizedPath === normalizedQuery) return 400
  if (normalizedTitle.startsWith(normalizedQuery) || normalizedPath.startsWith(normalizedQuery))
    return 300
  if (normalizedTitle.includes(normalizedQuery) || normalizedPath.includes(normalizedQuery))
    return 200
  if (
    fuzzyCharMatch(normalizedTitle, normalizedQuery) ||
    fuzzyCharMatch(normalizedPath, normalizedQuery)
  )
    return 120

  return 100
}

async function walkSearchableFiles(
  directoryPath: string,
  relativeDirectoryPath: string,
  inheritedRules: IgnoreRule[],
  options: NormalizedSearchOptions,
  output: string[]
): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true, encoding: 'utf-8' })
  } catch {
    return
  }

  const localRules = options.includeIgnored
    ? []
    : await readIgnoreRulesForDirectory(directoryPath, relativeDirectoryPath)
  const nextRules = options.includeIgnored ? inheritedRules : [...inheritedRules, ...localRules]

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name === '.obsidian') continue
    if (entry.name.startsWith('.')) continue

    const relativePath = relativeDirectoryPath
      ? `${relativeDirectoryPath}/${entry.name}`
      : entry.name

    if (!options.includeIgnored && shouldIgnorePath(relativePath, entry.isDirectory(), nextRules)) {
      continue
    }

    if (entry.isDirectory()) {
      await walkSearchableFiles(
        join(directoryPath, entry.name),
        relativePath,
        nextRules,
        options,
        output
      )
      continue
    }

    if (!entry.isFile()) continue
    if (!passesPathFilters(relativePath, options)) continue

    output.push(relativePath)
  }
}

async function collectSearchableFiles(
  vaultPath: string,
  options: NormalizedSearchOptions
): Promise<string[]> {
  const results: string[] = []
  await walkSearchableFiles(vaultPath, '', [], options, results)
  return results
}

async function readTextFile(absolutePath: string): Promise<{
  content: string
  mtimeMs: number
  size: number
} | null> {
  let stats: Awaited<ReturnType<typeof fs.stat>>
  try {
    stats = await fs.stat(absolutePath)
  } catch {
    return null
  }

  if (!stats.isFile()) return null
  if (stats.size > MAX_FILE_SIZE_BYTES) return null

  let raw: Buffer
  try {
    raw = await fs.readFile(absolutePath)
  } catch {
    return null
  }

  if (raw.length > MAX_FILE_SIZE_BYTES) return null
  if (isLikelyBinary(raw)) return null

  const content = raw.toString('utf-8')
  if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE_BYTES) return null

  return {
    content,
    mtimeMs: stats.mtimeMs,
    size: stats.size
  }
}

function dedupeOpenBuffers(openBuffers: OpenBufferSnapshot[] | undefined): OpenBufferSnapshot[] {
  if (!openBuffers || openBuffers.length === 0) return []

  const deduped = new Map<string, OpenBufferSnapshot>()
  for (const snapshot of openBuffers) {
    const relativePath = normalizePath(snapshot.relativePath)
    if (relativePath.length === 0) continue
    deduped.set(relativePath, { ...snapshot, relativePath })
  }

  return [...deduped.values()]
}

export async function searchVaultContentV2(
  vaultPath: string,
  query: string,
  options?: SearchQueryOptions,
  openBuffers?: OpenBufferSnapshot[]
): Promise<SearchContentMatch[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) return []

  const resolvedVaultPath = await ensureVaultDirectory(vaultPath)
  const normalizedOptions = normalizeOptions(options)
  const { match: matchQuery, regexForRank } = buildQueryMatcher(trimmedQuery, normalizedOptions)

  const rankedResults: SearchResultWithScore[] = []
  const bufferSnapshots = dedupeOpenBuffers(openBuffers)
  const bufferPaths = new Set<string>()

  for (const snapshot of bufferSnapshots) {
    const relativePath = normalizePath(snapshot.relativePath)
    if (!passesPathFilters(relativePath, normalizedOptions)) continue

    bufferPaths.add(relativePath)
    const extension = extname(relativePath).toLowerCase()
    const searchableText = extension === '.md' ? extractBody(snapshot.content) : snapshot.content
    const queryMatch = matchQuery(searchableText)
    if (!queryMatch) continue

    const title = snapshot.title?.trim() || deriveTitle(relativePath, snapshot.content)
    const score = getTitlePathScore(
      title,
      relativePath,
      trimmedQuery,
      normalizedOptions,
      regexForRank
    )
    const { line, column } = computeLineColumn(searchableText, queryMatch.index)

    rankedResults.push({
      relativePath,
      title,
      snippet: buildSnippet(searchableText, queryMatch.index, queryMatch.length),
      mtimeMs: snapshot.mtimeMs ?? Date.now(),
      source: 'buffer',
      line,
      column,
      score
    })
  }

  const diskFiles = await collectSearchableFiles(resolvedVaultPath, normalizedOptions)
  for (const relativePath of diskFiles) {
    if (bufferPaths.has(relativePath)) continue
    const absolutePath = join(resolvedVaultPath, relativePath)
    const file = await readTextFile(absolutePath)
    if (!file) continue

    const extension = extname(relativePath).toLowerCase()
    const searchableText = extension === '.md' ? extractBody(file.content) : file.content
    const queryMatch = matchQuery(searchableText)
    if (!queryMatch) continue

    const title = deriveTitle(relativePath, file.content)
    const score = getTitlePathScore(
      title,
      relativePath,
      trimmedQuery,
      normalizedOptions,
      regexForRank
    )
    const { line, column } = computeLineColumn(searchableText, queryMatch.index)

    rankedResults.push({
      relativePath,
      title,
      snippet: buildSnippet(searchableText, queryMatch.index, queryMatch.length),
      mtimeMs: file.mtimeMs,
      source: 'disk',
      line,
      column,
      score
    })
  }

  rankedResults.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs - left.mtimeMs
    if (left.source !== right.source) return left.source === 'buffer' ? -1 : 1
    return left.relativePath.localeCompare(right.relativePath)
  })

  return rankedResults.slice(0, normalizedOptions.limit).map((item) => ({
    relativePath: item.relativePath,
    title: item.title,
    snippet: item.snippet,
    mtimeMs: item.mtimeMs,
    source: item.source,
    line: item.line,
    column: item.column
  }))
}

export async function searchVaultTitlesV2(
  vaultPath: string,
  query: string,
  options?: SearchQueryOptions
): Promise<TitleSearchMatch[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) return []

  const resolvedVaultPath = await ensureVaultDirectory(vaultPath)
  const normalizedOptions = normalizeOptions({ ...options, regex: false })
  const searchableFiles = await collectSearchableFiles(resolvedVaultPath, normalizedOptions)
  const normalizedQuery = normalizedOptions.caseSensitive
    ? trimmedQuery
    : trimmedQuery.toLowerCase()
  const matches: TitleSearchMatch[] = []

  for (const relativePath of searchableFiles) {
    const absolutePath = join(resolvedVaultPath, relativePath)
    const file = await readTextFile(absolutePath)
    if (!file) continue

    const title = deriveTitle(relativePath, file.content)
    const normalizedTitle = normalizedOptions.caseSensitive ? title : title.toLowerCase()
    const normalizedPath = normalizedOptions.caseSensitive
      ? relativePath
      : relativePath.toLowerCase()

    let score = 0
    if (normalizedTitle === normalizedQuery || normalizedPath === normalizedQuery) {
      score = 400
    } else if (
      normalizedTitle.startsWith(normalizedQuery) ||
      normalizedPath.startsWith(normalizedQuery)
    ) {
      score = 300
    } else if (
      normalizedTitle.includes(normalizedQuery) ||
      normalizedPath.includes(normalizedQuery)
    ) {
      score = 220
    } else if (
      fuzzyCharMatch(normalizedTitle, normalizedQuery) ||
      fuzzyCharMatch(normalizedPath, normalizedQuery)
    ) {
      score = 150
    }

    if (score <= 0) continue

    matches.push({
      relativePath,
      title,
      mtimeMs: file.mtimeMs,
      size: file.size,
      score
    })
  }

  matches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs - left.mtimeMs
    return left.relativePath.localeCompare(right.relativePath)
  })

  return matches.slice(0, normalizedOptions.limit)
}
