import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createVaultFolder,
  deleteVaultFolder,
  moveVaultNote,
  renameVaultFolder,
  sanitizeRelativePath,
  isPathInsideRoot,
  normalizeNoteTitle,
  slugifyTitle,
  resolveNotePath
} from '../vault-files'

describe('sanitizeRelativePath', () => {
  it('accepts a simple relative path', () => {
    expect(sanitizeRelativePath('notes/hello.md')).toBe('notes/hello.md')
  })

  it('accepts a single filename', () => {
    expect(sanitizeRelativePath('hello.md')).toBe('hello.md')
  })

  it('rejects empty strings', () => {
    expect(() => sanitizeRelativePath('')).toThrow('Invalid note path.')
  })

  it('rejects non-string input', () => {
    expect(() => sanitizeRelativePath(null as unknown as string)).toThrow('Invalid note path.')
    expect(() => sanitizeRelativePath(undefined as unknown as string)).toThrow('Invalid note path.')
  })

  it('rejects absolute paths', () => {
    expect(() => sanitizeRelativePath('/etc/passwd')).toThrow('Invalid note path.')
  })

  it('rejects paths with null bytes', () => {
    expect(() => sanitizeRelativePath('hello\0.md')).toThrow('Invalid note path.')
  })

  it('rejects parent directory traversal', () => {
    expect(() => sanitizeRelativePath('../secret.md')).toThrow('Invalid note path.')
    expect(() => sanitizeRelativePath('notes/../../secret.md')).toThrow('Invalid note path.')
  })

  it('normalizes dot segments', () => {
    expect(sanitizeRelativePath('./hello.md')).toBe('hello.md')
  })

  it('normalizes double slashes', () => {
    expect(sanitizeRelativePath('notes//hello.md')).toBe('notes/hello.md')
  })

  it('normalizes backslashes to forward slashes', () => {
    expect(sanitizeRelativePath('notes\\hello.md')).toBe('notes/hello.md')
  })
})

describe('isPathInsideRoot', () => {
  it('returns true for a child path', () => {
    expect(isPathInsideRoot('/vault', '/vault/notes/hello.md')).toBe(true)
  })

  it('returns false for the root itself', () => {
    expect(isPathInsideRoot('/vault', '/vault')).toBe(false)
  })

  it('returns false for a parent path', () => {
    expect(isPathInsideRoot('/vault', '/other')).toBe(false)
  })

  it('returns false for traversal above root', () => {
    expect(isPathInsideRoot('/vault', '/vault/../etc/passwd')).toBe(false)
  })
})

describe('normalizeNoteTitle', () => {
  it('trims whitespace', () => {
    expect(normalizeNoteTitle('  hello  ')).toBe('hello')
  })

  it('replaces newlines with spaces', () => {
    expect(normalizeNoteTitle('hello\nworld')).toBe('hello world')
  })

  it('rejects empty string after trimming', () => {
    expect(() => normalizeNoteTitle('   ')).toThrow('Note title cannot be empty.')
  })

  it('rejects non-string input', () => {
    expect(() => normalizeNoteTitle(42 as unknown as string)).toThrow('Note title is required.')
  })
})

describe('slugifyTitle', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyTitle('Hello World')).toBe('hello-world')
  })

  it('handles unicode characters', () => {
    const slug = slugifyTitle('Über Café')
    expect(slug).toMatch(/^[a-z\u00e0-\u024f-]+$/)
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugifyTitle('  hello  ')).toBe('hello')
  })

  it('collapses multiple separators', () => {
    expect(slugifyTitle('hello   world')).toBe('hello-world')
  })
})

describe('resolveNotePath', () => {
  it('resolves a valid relative path', () => {
    const result = resolveNotePath('/vault', 'notes/hello.md')
    expect(result).toContain('notes')
    expect(result).toContain('hello.md')
  })

  it('throws for paths escaping vault', () => {
    expect(() => resolveNotePath('/vault', '../etc/passwd')).toThrow()
  })
})

describe('vault operation validation', () => {
  it('rejects creating an already existing folder', async () => {
    const createdVault = await fs.mkdtemp(join(tmpdir(), 'onpoint-vault-'))
    const vault = await fs.realpath(createdVault)
    try {
      await createVaultFolder(vault, 'docs')
      await expect(createVaultFolder(vault, 'docs')).rejects.toThrow(
        'already exists at this location'
      )
    } finally {
      await fs.rm(vault, { recursive: true, force: true })
    }
  })

  it('deletes an empty folder', async () => {
    const createdVault = await fs.mkdtemp(join(tmpdir(), 'onpoint-vault-'))
    const vault = await fs.realpath(createdVault)
    try {
      await fs.mkdir(join(vault, 'docs'))
      await expect(deleteVaultFolder(vault, 'docs')).resolves.toEqual({ deletedPath: 'docs' })
      await expect(fs.stat(join(vault, 'docs'))).rejects.toThrow()
    } finally {
      await fs.rm(vault, { recursive: true, force: true })
    }
  })

  it('rejects moving a note onto an existing target path', async () => {
    const createdVault = await fs.mkdtemp(join(tmpdir(), 'onpoint-vault-'))
    const vault = await fs.realpath(createdVault)
    try {
      await fs.writeFile(join(vault, 'source.md'), '# Source\n', 'utf-8')
      await fs.writeFile(join(vault, 'target.md'), '# Target\n', 'utf-8')

      await expect(moveVaultNote(vault, 'source.md', 'target.md')).rejects.toThrow(
        'already exists at this location'
      )
    } finally {
      await fs.rm(vault, { recursive: true, force: true })
    }
  })

  it('rejects renaming a folder onto an existing destination path', async () => {
    const createdVault = await fs.mkdtemp(join(tmpdir(), 'onpoint-vault-'))
    const vault = await fs.realpath(createdVault)
    try {
      await fs.mkdir(join(vault, 'from'))
      await fs.mkdir(join(vault, 'to'))

      await expect(renameVaultFolder(vault, 'from', 'to')).rejects.toThrow(
        'already exists at this location'
      )
    } finally {
      await fs.rm(vault, { recursive: true, force: true })
    }
  })
})
