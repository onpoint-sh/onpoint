import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { SearchContentMatch } from '@onpoint/shared/notes'
import { fuzzySearchNotes } from '@/lib/fuzzy-search'
import { useNotesStore } from '@/stores/notes-store'
import { usePanesStore } from '@/stores/panes-store'
import { useSearchBufferStore } from '@/stores/search-buffer-store'

type SearchResult = {
  relativePath: string
  title: string
  snippet?: string
  line?: number
  section: 'title' | 'content'
}

type SearchPaletteProps = {
  onClose: () => void
}

function SearchPalette({ onClose }: SearchPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [contentResults, setContentResults] = useState<SearchContentMatch[]>([])
  const [isContentLoading, setIsContentLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRequestIdRef = useRef(0)
  const notes = useNotesStore((state) => state.notes)
  const bufferSnapshotMap = useSearchBufferStore((state) => state.snapshots)
  const openBufferSnapshots = useMemo(() => Object.values(bufferSnapshotMap), [bufferSnapshotMap])

  const trimmedQuery = query.trim()

  // Fuzzy title search (synchronous, in-memory)
  const titleResults: SearchResult[] = useMemo(() => {
    if (trimmedQuery.length === 0) return []
    return fuzzySearchNotes(notes, trimmedQuery).map((r) => ({
      relativePath: r.note.relativePath,
      title: r.note.title,
      section: 'title' as const
    }))
  }, [notes, trimmedQuery])

  // Content search (debounced IPC) — runs in parallel with title search
  useEffect(() => {
    if (trimmedQuery.length < 2) {
      searchRequestIdRef.current += 1
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    const timeoutId = setTimeout(() => {
      window.notes
        .searchContentV2(trimmedQuery, { limit: 40 }, openBufferSnapshots)
        .then((matches) => {
          if (searchRequestIdRef.current !== requestId) return
          setContentResults(matches)
          setIsContentLoading(false)
        })
        .catch(() => {
          if (searchRequestIdRef.current !== requestId) return
          setIsContentLoading(false)
        })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [openBufferSnapshots, trimmedQuery])

  // Merge results: title matches first, then content matches (deduplicated)
  const results: SearchResult[] = useMemo(() => {
    const visibleContentResults = trimmedQuery.length < 2 ? [] : contentResults
    const titlePaths = new Set(titleResults.map((r) => r.relativePath))
    const dedupedContent: SearchResult[] = visibleContentResults
      .filter((m) => !titlePaths.has(m.relativePath))
      .map((m) => ({
        relativePath: m.relativePath,
        title: m.title,
        snippet: m.snippet,
        line: m.line,
        section: 'content' as const
      }))
    return [...titleResults, ...dedupedContent]
  }, [titleResults, contentResults, trimmedQuery])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSelect = useCallback(
    (relativePath: string) => {
      usePanesStore.getState().openTab(relativePath)
      onClose()
    },
    [onClose]
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

  // Derive folder path from relativePath for display
  const getFolderPath = (relativePath: string): string | null => {
    const lastSlash = relativePath.lastIndexOf('/')
    if (lastSlash === -1) return null
    return relativePath.slice(0, lastSlash)
  }

  // Check if this result is the first in its section (for rendering headers)
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
            onChange={(e) => {
              const nextQuery = e.target.value
              const nextTrimmedQuery = nextQuery.trim()
              setQuery(nextQuery)
              setSelectedIndex(0)
              if (nextTrimmedQuery.length < 2) {
                searchRequestIdRef.current += 1
                setContentResults([])
                setIsContentLoading(false)
              } else {
                setIsContentLoading(true)
              }
            }}
            placeholder="Search files..."
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
                    <span className="search-palette-result-snippet">
                      {result.line ? `L${result.line}: ${result.snippet}` : result.snippet}
                    </span>
                  )}
                </button>
              </div>
            )
          })}

          {trimmedQuery.length >= 2 && isContentLoading && results.length === 0 && (
            <p className="search-palette-empty">Searching...</p>
          )}

          {trimmedQuery.length > 0 && results.length === 0 && !isContentLoading && (
            <p className="search-palette-empty">No results found.</p>
          )}
        </div>
      </div>
    </>
  )
}

export { SearchPalette }
