import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const IGNORE_FILE_NAMES = ['.gitignore', '.ignore', '.rgignore'] as const

type IgnoreRule = {
  negate: boolean
  directoryOnly: boolean
  regex: RegExp
}

type CompiledGlob = {
  raw: string
  regex: RegExp
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/')
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function globToRegexBody(glob: string): string {
  let body = ''

  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i]
    const next = glob[i + 1]

    if (char === '*') {
      if (next === '*') {
        const nextNext = glob[i + 2]
        if (nextNext === '/') {
          body += '(?:.*/)?'
          i += 2
        } else {
          body += '.*'
          i += 1
        }
      } else {
        body += '[^/]*'
      }
      continue
    }

    if (char === '?') {
      body += '[^/]'
      continue
    }

    body += escapeRegex(char)
  }

  return body
}

function normalizePattern(pattern: string): string {
  return toPosixPath(pattern.trim()).replace(/^\.\/+/, '')
}

function compileIgnorePattern(pattern: string, baseDir: string): RegExp | null {
  const normalized = normalizePattern(pattern)
  if (normalized.length === 0) return null

  const anchored = normalized.startsWith('/')
  const stripped = normalized.replace(/^\/+/, '').replace(/\/+$/, '')
  if (stripped.length === 0) return null

  const hasSlash = stripped.includes('/')
  const basePrefix = baseDir.length > 0 ? `${escapeRegex(baseDir)}/` : ''
  const patternBody = globToRegexBody(stripped)

  if (anchored || hasSlash) {
    return new RegExp(`^${basePrefix}${patternBody}(?:/.*)?$`)
  }

  return new RegExp(`^${basePrefix}(?:.*/)?${patternBody}(?:/.*)?$`)
}

function parseIgnoreContent(raw: string, baseDir: string): IgnoreRule[] {
  const rules: IgnoreRule[] = []
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    if (trimmed.startsWith('#')) continue

    const negate = trimmed.startsWith('!')
    const candidate = negate ? trimmed.slice(1).trim() : trimmed
    if (candidate.length === 0) continue

    const directoryOnly = candidate.endsWith('/')
    const regex = compileIgnorePattern(candidate, baseDir)
    if (!regex) continue

    rules.push({ negate, directoryOnly, regex })
  }

  return rules
}

export async function readIgnoreRulesForDirectory(
  absoluteDirectoryPath: string,
  relativeDirectoryPath: string
): Promise<IgnoreRule[]> {
  const rules: IgnoreRule[] = []

  for (const fileName of IGNORE_FILE_NAMES) {
    const ignorePath = join(absoluteDirectoryPath, fileName)
    let content: string

    try {
      content = await fs.readFile(ignorePath, 'utf-8')
    } catch {
      continue
    }

    rules.push(...parseIgnoreContent(content, relativeDirectoryPath))
  }

  return rules
}

export function shouldIgnorePath(
  relativePath: string,
  _isDirectory: boolean,
  rules: IgnoreRule[]
): boolean {
  const normalizedPath = toPosixPath(relativePath)
  let ignored = false

  for (const rule of rules) {
    if (!rule.regex.test(normalizedPath)) continue
    ignored = !rule.negate
  }

  return ignored
}

function compileSingleGlob(glob: string): RegExp | null {
  const normalized = normalizePattern(glob)
  if (normalized.length === 0) return null

  const anchored = normalized.startsWith('/')
  const stripped = normalized.replace(/^\/+/, '')
  if (stripped.length === 0) return null

  const body = globToRegexBody(stripped)
  if (anchored) {
    return new RegExp(`^${body}$`)
  }

  return new RegExp(`^(?:.*/)?${body}$`)
}

export function compileGlobSet(globs: string[] | undefined): CompiledGlob[] {
  if (!globs || globs.length === 0) return []

  const compiled: CompiledGlob[] = []
  for (const glob of globs) {
    const regex = compileSingleGlob(glob)
    if (!regex) continue
    compiled.push({ raw: glob, regex })
  }

  return compiled
}

export function matchesGlobSet(relativePath: string, compiledGlobs: CompiledGlob[]): boolean {
  if (compiledGlobs.length === 0) return false
  const normalizedPath = toPosixPath(relativePath)
  return compiledGlobs.some((glob) => glob.regex.test(normalizedPath))
}

export type { IgnoreRule, CompiledGlob }
