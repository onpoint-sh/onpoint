import type { NoteSummary } from '@onpoint/shared/notes'

export type FuzzySearchResult = {
  note: NoteSummary
  score: number
}

export function fuzzySearchNotes(
  notes: NoteSummary[],
  query: string,
  maxResults = 20
): FuzzySearchResult[] {
  if (query.length === 0) return []

  const lowerQuery = query.toLowerCase()
  const results: FuzzySearchResult[] = []

  for (const note of notes) {
    const score = scoreNote(note, lowerQuery)
    if (score > 0) {
      results.push({ note, score })
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.note.mtimeMs - a.note.mtimeMs
  })

  return results.slice(0, maxResults)
}

function scoreNote(note: NoteSummary, lowerQuery: string): number {
  const lowerTitle = note.title.toLowerCase()
  const lowerPath = note.relativePath.toLowerCase()

  if (lowerTitle.startsWith(lowerQuery)) return 100
  if (lowerTitle.includes(lowerQuery)) return 80
  if (lowerPath.includes(lowerQuery)) return 60
  if (fuzzyCharMatch(lowerTitle, lowerQuery)) return 40
  if (fuzzyCharMatch(lowerPath, lowerQuery)) return 20

  return 0
}

function fuzzyCharMatch(text: string, query: string): boolean {
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      qi++
    }
  }
  return qi === query.length
}
