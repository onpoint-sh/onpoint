import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  buildNoteContent,
  extractTitle,
  replaceFrontmatterTitle,
  type NoteFrontmatter
} from '@onpoint/shared/frontmatter'

describe('parseFrontmatter', () => {
  it('parses title and created from frontmatter', () => {
    const raw = '---\ntitle: Hello\ncreated: 2025-01-01\n---\n\nBody text'
    const result = parseFrontmatter(raw)
    expect(result.metadata.title).toBe('Hello')
    expect(result.metadata.created).toBe('2025-01-01')
    expect(result.body).toBe('Body text')
  })

  it('returns null metadata when no frontmatter', () => {
    const raw = 'Just some text'
    const result = parseFrontmatter(raw)
    expect(result.metadata.title).toBeNull()
    expect(result.metadata.created).toBeNull()
    expect(result.body).toBe('Just some text')
  })

  it('handles double-quoted titles with escaped quotes', () => {
    const raw = '---\ntitle: "Hello \\"World\\""\n---\n'
    const result = parseFrontmatter(raw)
    expect(result.metadata.title).toBe('Hello "World"')
  })

  it('handles double-quoted titles with escaped backslashes', () => {
    const raw = '---\ntitle: "path\\\\to\\\\file"\n---\n'
    const result = parseFrontmatter(raw)
    expect(result.metadata.title).toBe('path\\to\\file')
  })

  it('handles escaped backslash before escaped quote correctly', () => {
    // Input: title: "ends with backslash\\\\"
    // The YAML value is: ends with backslash\
    const raw = '---\ntitle: "ends with backslash\\\\"\n---\n'
    const result = parseFrontmatter(raw)
    expect(result.metadata.title).toBe('ends with backslash\\')
  })

  it('handles single-quoted titles', () => {
    const raw = "---\ntitle: 'Hello World'\n---\n"
    const result = parseFrontmatter(raw)
    expect(result.metadata.title).toBe('Hello World')
  })
})

describe('buildNoteContent', () => {
  it('builds frontmatter with title and created', () => {
    const metadata: NoteFrontmatter = { title: 'Test', created: '2025-01-01' }
    const result = buildNoteContent(metadata, 'Body')
    expect(result).toContain('title: Test')
    expect(result).toContain('created: 2025-01-01')
    expect(result).toContain('Body')
  })

  it('quotes titles with special YAML characters', () => {
    const metadata: NoteFrontmatter = { title: 'Hello: World', created: null }
    const result = buildNoteContent(metadata, '')
    expect(result).toContain('title: "Hello: World"')
  })

  it('quotes titles that are YAML booleans', () => {
    const metadata: NoteFrontmatter = { title: 'true', created: null }
    const result = buildNoteContent(metadata, '')
    expect(result).toContain('title: "true"')
  })

  it('quotes titles that are YAML null', () => {
    const metadata: NoteFrontmatter = { title: 'null', created: null }
    const result = buildNoteContent(metadata, '')
    expect(result).toContain('title: "null"')
  })

  it('quotes numeric titles', () => {
    const metadata: NoteFrontmatter = { title: '42', created: null }
    const result = buildNoteContent(metadata, '')
    expect(result).toContain('title: "42"')
  })
})

describe('round-trip', () => {
  it('preserves title through build → parse cycle', () => {
    const titles = [
      'Simple title',
      'Title with: colon',
      'Title with "quotes"',
      'Title with backslash\\here',
      'true',
      'null',
      '42',
      'Title with #hash',
      'Title with [brackets]'
    ]

    for (const title of titles) {
      const content = buildNoteContent({ title, created: null }, '')
      const parsed = parseFrontmatter(content)
      expect(parsed.metadata.title).toBe(title)
    }
  })
})

describe('extractTitle', () => {
  it('extracts title from frontmatter', () => {
    expect(extractTitle('---\ntitle: Hello\n---\n')).toBe('Hello')
  })

  it('returns null when no frontmatter', () => {
    expect(extractTitle('Just text')).toBeNull()
  })
})

describe('replaceFrontmatterTitle', () => {
  it('replaces existing title', () => {
    const raw = '---\ntitle: Old\n---\n\nBody'
    const result = replaceFrontmatterTitle(raw, 'New')
    const parsed = parseFrontmatter(result)
    expect(parsed.metadata.title).toBe('New')
    expect(parsed.body).toBe('Body')
  })

  it('adds frontmatter if none exists', () => {
    const raw = 'Just body text'
    const result = replaceFrontmatterTitle(raw, 'Added')
    const parsed = parseFrontmatter(result)
    expect(parsed.metadata.title).toBe('Added')
  })
})
