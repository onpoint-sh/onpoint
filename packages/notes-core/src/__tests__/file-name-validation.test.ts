import { describe, expect, it } from 'vitest'
import {
  isValidBasename,
  normalizeProposedName,
  validateProposedTreeName
} from '../file-name-validation'

describe('normalizeProposedName', () => {
  it('removes tabs and trailing separators', () => {
    expect(normalizeProposedName('\tfoo/bar\\\\')).toBe('foo/bar')
  })
})

describe('isValidBasename', () => {
  it('accepts valid basenames', () => {
    expect(isValidBasename('notes', true)).toBe(true)
    expect(isValidBasename('notes', false)).toBe(true)
  })

  it('rejects invalid characters by platform rules', () => {
    expect(isValidBasename('foo:bar', true)).toBe(false)
    expect(isValidBasename('foo:bar', false)).toBe(true)
    expect(isValidBasename('foo/bar', false)).toBe(false)
  })

  it('rejects windows reserved names', () => {
    expect(isValidBasename('con', true)).toBe(false)
    expect(isValidBasename('LPT1', true)).toBe(false)
    expect(isValidBasename('con', false)).toBe(true)
  })

  it('rejects relative-only segments', () => {
    expect(isValidBasename('.', true)).toBe(false)
    expect(isValidBasename('..', false)).toBe(false)
  })

  it('treats leading/trailing whitespace as valid by default', () => {
    expect(isValidBasename(' foo ', true)).toBe(true)
  })

  it('can reject leading/trailing whitespace when configured', () => {
    expect(
      isValidBasename(' foo ', true, {
        allowLeadingTrailingWhitespace: false
      })
    ).toBe(false)
  })
})

describe('validateProposedTreeName', () => {
  it('returns empty-name error', () => {
    const result = validateProposedTreeName({
      proposedName: '   '
    })
    expect(result?.code).toBe('empty')
    expect(result?.severity).toBe('error')
  })

  it('returns starts-with-slash error', () => {
    const result = validateProposedTreeName({
      proposedName: '/hello'
    })
    expect(result?.code).toBe('starts_with_slash')
  })

  it('returns duplicate error when target path exists', () => {
    const result = validateProposedTreeName({
      proposedName: 'renamed.md',
      parentPath: 'notes',
      currentPath: 'notes/original.md',
      existingPaths: ['notes/renamed.md'],
      isWindows: false
    })
    expect(result?.code).toBe('already_exists')
  })

  it('ignores duplicate check for same current path', () => {
    const result = validateProposedTreeName({
      proposedName: 'original.md',
      parentPath: 'notes',
      currentPath: 'notes/original.md',
      existingPaths: ['notes/original.md'],
      isWindows: false
    })
    expect(result).toBeNull()
  })

  it('returns invalid-name error for invalid segments', () => {
    const result = validateProposedTreeName({
      proposedName: 'folder//name',
      parentPath: 'notes',
      isWindows: false
    })
    expect(result?.code).toBe('invalid_name')
  })

  it('returns whitespace warning for edge whitespace', () => {
    const result = validateProposedTreeName({
      proposedName: ' folder ',
      parentPath: 'notes',
      isWindows: false
    })
    expect(result?.code).toBe('leading_trailing_whitespace')
    expect(result?.severity).toBe('warning')
  })
})
