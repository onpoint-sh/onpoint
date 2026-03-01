import type { SearchQueryOptions } from '@onpoint/shared/notes'

type SearchCommandOptions = {
  limit?: number
  include?: string[]
  exclude?: string[]
  type?: string[]
  includeIgnored?: boolean
  caseSensitive?: boolean
  regex?: boolean
}

export function collectRepeatableOption(value: string, previous: string[] = []): string[] {
  return [...previous, value]
}

export function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Limit must be a positive integer.')
  }
  return parsed
}

export function buildSearchQueryOptions(options: SearchCommandOptions): SearchQueryOptions {
  return {
    limit: options.limit,
    includeGlobs: options.include ?? [],
    excludeGlobs: options.exclude ?? [],
    fileTypes: options.type ?? [],
    includeIgnored: options.includeIgnored === true,
    caseSensitive: options.caseSensitive === true,
    regex: options.regex === true
  }
}
