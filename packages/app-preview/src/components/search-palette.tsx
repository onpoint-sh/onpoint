import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { fuzzySearchNotes } from '@onpoint/notes-core/fuzzy-search'
import { parseFrontmatter } from '@onpoint/shared/frontmatter'
import { useAppPreview } from '../context'
import { usePreviewStore } from '../store'

type SearchResult = {
  relativePath: string
  title: string
  snippet?: string
  section: 'title' | 'content'
}

type SearchPaletteProps = {
  onClose: () => void
}

function buildSnippet(content: string, query: string, radius = 40): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return ''
  const start = Math.max(0, idx - radius)
  const end = Math.min(content.length, idx + query.length + radius)
  let snippet = content.slice(start, end).replace(/\n/g, ' ')
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet += '...'
  return snippet
}

function searchContent(
  contentMap: Map<string, string>,
  notes: { relativePath: string; title: string }[],
  query: string,
  maxResults = 20
): SearchResult[] {
  const lowerQuery = query.toLowerCase()
  const results: SearchResult[] = []

  for (const note of notes) {
    const raw = contentMap.get(note.relativePath)
    if (!raw) continue
    const { body } = parseFrontmatter(raw)
    if (body.toLowerCase().includes(lowerQuery)) {
      results.push({
        relativePath: note.relativePath,
        title: note.title,
        snippet: buildSnippet(body, query),
        section: 'content'
      })
      if (results.length >= maxResults) break
    }
  }

  return results
}

export function SearchPalette({ onClose }: SearchPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { notes, contentMap } = useAppPreview()
  const openTab = usePreviewStore((s) => s.openTab)

  const trimmedQuery = query.trim()

  // Fuzzy title search (synchronous, in-memory)
  const titleResults: SearchResult[] = useMemo(() => {
    if (trimmedQuery.length === 0) return []
    return fuzzySearchNotes(notes, trimmedQuery).map(
      (r: { note: { relativePath: string; title: string } }) => ({
        relativePath: r.note.relativePath,
        title: r.note.title,
        section: 'title' as const
      })
    )
  }, [notes, trimmedQuery])

  // Content search (synchronous, in-memory)
  const contentResults: SearchResult[] = useMemo(() => {
    if (trimmedQuery.length < 2) return []
    return searchContent(contentMap, notes, trimmedQuery)
  }, [contentMap, notes, trimmedQuery])

  // Merge results: title matches first, then content matches (deduplicated)
  const results: SearchResult[] = useMemo(() => {
    const titlePaths = new Set(titleResults.map((r) => r.relativePath))
    const dedupedContent = contentResults.filter((m) => !titlePaths.has(m.relativePath))
    return [...titleResults, ...dedupedContent]
  }, [titleResults, contentResults])

  // Reset selection when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0)
  }, [trimmedQuery])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSelect = useCallback(
    (relativePath: string) => {
      openTab(relativePath)
      onClose()
    },
    [openTab, onClose]
  )

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (results.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % results.length)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (results.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].relativePath)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [results, selectedIndex, handleSelect, onClose]
  )

  const getFolderPath = (relativePath: string): string | null => {
    const lastSlash = relativePath.lastIndexOf('/')
    if (lastSlash === -1) return null
    return relativePath.slice(0, lastSlash)
  }

  const isFirstInSection = (index: number): boolean => {
    if (index === 0) return true
    return results[index].section !== results[index - 1].section
  }

  const hasContentSection = results.some((r) => r.section === 'content')
  const hasTitleSection = results.some((r) => r.section === 'title')
  const showSectionHeaders = hasTitleSection && hasContentSection

  return (
    <>
      <div className="search-palette-overlay" onClick={onClose} />
      <div className="search-palette-dialog" onKeyDown={handleKeyDown}>
        <div className="search-palette-input-row">
          <Search className="search-palette-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="search-palette-input"
            spellCheck={false}
          />
        </div>

        <div className="search-palette-results" ref={listRef}>
          {results.map((result, index) => {
            const folder = getFolderPath(result.relativePath)
            return (
              <div key={`${result.section}-${result.relativePath}`}>
                {showSectionHeaders && isFirstInSection(index) && (
                  <div className="search-palette-section-header">
                    {result.section === 'title' ? 'Titles' : 'Content'}
                  </div>
                )}
                <button
                  data-selected={index === selectedIndex}
                  className="search-palette-result"
                  onClick={() => handleSelect(result.relativePath)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="search-palette-result-title">{result.title}</span>
                  {folder && <span className="search-palette-result-path">{folder}</span>}
                  {result.snippet && (
                    <span className="search-palette-result-snippet">{result.snippet}</span>
                  )}
                </button>
              </div>
            )
          })}

          {trimmedQuery.length > 0 && results.length === 0 && (
            <p className="search-palette-empty">No results found.</p>
          )}
        </div>
      </div>
    </>
  )
}
