import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Editor from '@monaco-editor/react'
import mermaid from 'mermaid'
import { Code, Eye, Maximize, Minus, Plus } from 'lucide-react'
import { isUntitledPath } from '@onpoint/shared/notes'
import { usePaneContent } from '@/hooks/use-pane-content'
import { useMonacoTheme } from '@/hooks/use-monaco-theme'
import { usePanesStore } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'
import { useThemeStore } from '@/stores/theme-store'
import { tabSaveCallbacks } from '@/lib/tab-save-callbacks'

type ViewMode = 'code' | 'preview'

function subscribeToSystemTheme(callback: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function subscribeToThemeClass(callback: () => void): () => void {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
  return () => observer.disconnect()
}

function getThemeClassIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function useIsDark(): boolean {
  // Keep subscriptions so system/theme mode transitions also trigger rerenders.
  useThemeStore((s) => s.mode)
  useThemeStore((s) => s.lightThemeId)
  useThemeStore((s) => s.darkThemeId)
  useSyncExternalStore(subscribeToSystemTheme, getSystemIsDark)

  return useSyncExternalStore(subscribeToThemeClass, getThemeClassIsDark, getThemeClassIsDark)
}

const MIN_SCALE = 0.1
const MAX_SCALE = 5

let mermaidInitialized = false

type MermaidEditorProps = {
  tabId?: string
  relativePath: string | null
  focusRequestId?: number
  onFocusConsumed?: () => void
}

function MermaidEditor({
  tabId,
  relativePath,
  focusRequestId = 0,
  onFocusConsumed
}: MermaidEditorProps): React.JSX.Element {
  const { content, setContent, isLoading, isDirty, saveError, flushSave, getContent } =
    usePaneContent(relativePath)
  const markTabDirty = usePanesStore((s) => s.markTabDirty)
  const markTabClean = usePanesStore((s) => s.markTabClean)
  const { monacoTheme, applyMonacoTheme } = useMonacoTheme()
  const isDark = useIsDark()

  const [viewMode, setViewMode] = useState<ViewMode>('code')
  const [svgOutput, setSvgOutput] = useState<string>('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const relativePathRef = useRef(relativePath)
  const savingAsRef = useRef(false)
  const renderIdRef = useRef(0)

  // Pan/zoom — use refs for gesture performance, React state only for toolbar display
  const scaleRef = useRef(1)
  const translateRef = useRef({ x: 0, y: 0 })
  const [displayScale, setDisplayScale] = useState(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const translateStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    relativePathRef.current = relativePath
  }, [relativePath])

  // Sync dirty state to the store
  useEffect(() => {
    if (!tabId) return
    if (isDirty) {
      markTabDirty(tabId)
    } else {
      markTabClean(tabId)
    }
  }, [tabId, isDirty, markTabDirty, markTabClean])

  // Register save callback
  useEffect(() => {
    if (!tabId || !relativePath) return

    const callback = async (): Promise<boolean> => {
      if (isUntitledPath(relativePath)) {
        const currentContent = getContent()
        const result = await window.notes.saveNoteAs(currentContent)
        if (!result) return false
        usePanesStore.getState().updateTabPath(relativePath, result.relativePath)
        void useNotesStore.getState().refreshNotesList()
        return true
      } else {
        await flushSave()
        return true
      }
    }

    tabSaveCallbacks.set(tabId, callback)
    return () => {
      tabSaveCallbacks.delete(tabId)
    }
  }, [tabId, relativePath, getContent, flushSave])

  const handleSaveAs = useCallback(async () => {
    if (savingAsRef.current) return
    savingAsRef.current = true
    try {
      const currentContent = getContent()
      const result = await window.notes.saveNoteAs(currentContent)
      if (!result) return
      const oldPath = relativePathRef.current
      if (oldPath) {
        usePanesStore.getState().updateTabPath(oldPath, result.relativePath)
      }
      void useNotesStore.getState().refreshNotesList()
    } finally {
      savingAsRef.current = false
    }
  }, [getContent])

  // Cmd+S / Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        const path = relativePathRef.current
        if (!path) return
        if (isUntitledPath(path)) {
          void handleSaveAs()
        } else {
          void flushSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveAs, flushSave])

  // Consume focus request
  useEffect(() => {
    if (!relativePath || !focusRequestId) return
    onFocusConsumed?.()
  }, [relativePath, focusRequestId, onFocusConsumed])

  // Initialize mermaid and render diagram
  useEffect(() => {
    if (!content || isLoading) {
      setSvgOutput('')
      setRenderError(null)
      return
    }

    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'strict'
      })
      mermaidInitialized = true
    } else {
      mermaid.initialize({
        theme: isDark ? 'dark' : 'default'
      })
    }

    renderIdRef.current += 1
    const currentRenderId = renderIdRef.current
    const renderDiagramId = `mermaid-diagram-${currentRenderId}`

    mermaid
      .render(renderDiagramId, content)
      .then(({ svg }) => {
        if (renderIdRef.current !== currentRenderId) return
        setSvgOutput(svg)
        setRenderError(null)
      })
      .catch((err: unknown) => {
        if (renderIdRef.current !== currentRenderId) return
        setSvgOutput('')
        setRenderError(err instanceof Error ? err.message : 'Failed to render diagram')
      })
  }, [content, isLoading, isDark])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setContent(value)
      }
    },
    [setContent]
  )

  // Zoom helpers — mutate refs and apply directly to DOM for smooth 60fps
  const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const applyTransform = useCallback(() => {
    const el = svgContainerRef.current
    if (!el) return
    const { x, y } = translateRef.current
    el.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`
  }, [])

  const syncDisplayScale = useCallback(() => {
    setDisplayScale(scaleRef.current)
  }, [])

  const zoomIn = useCallback(() => {
    scaleRef.current = clampScale(scaleRef.current * 1.25)
    applyTransform()
    syncDisplayScale()
  }, [applyTransform, syncDisplayScale])

  const zoomOut = useCallback(() => {
    scaleRef.current = clampScale(scaleRef.current / 1.25)
    applyTransform()
    syncDisplayScale()
  }, [applyTransform, syncDisplayScale])

  const fitToPage = useCallback(() => {
    const container = containerRef.current
    const svgEl = svgContainerRef.current?.querySelector('svg')
    if (!container || !svgEl) {
      scaleRef.current = 1
      translateRef.current = { x: 0, y: 0 }
      applyTransform()
      syncDisplayScale()
      return
    }

    const containerRect = container.getBoundingClientRect()
    const svgWidth = svgEl.viewBox?.baseVal?.width || svgEl.getBoundingClientRect().width
    const svgHeight = svgEl.viewBox?.baseVal?.height || svgEl.getBoundingClientRect().height

    if (svgWidth === 0 || svgHeight === 0) {
      scaleRef.current = 1
      translateRef.current = { x: 0, y: 0 }
      applyTransform()
      syncDisplayScale()
      return
    }

    const padding = 32
    const availableWidth = containerRect.width - padding * 2
    const availableHeight = containerRect.height - padding * 2
    scaleRef.current = clampScale(Math.min(availableWidth / svgWidth, availableHeight / svgHeight))
    translateRef.current = { x: 0, y: 0 }
    applyTransform()
    syncDisplayScale()
  }, [applyTransform, syncDisplayScale])

  // Wheel zoom (scroll wheel + pinch via trackpad) — direct DOM, no React state
  useEffect(() => {
    const container = containerRef.current
    if (!container || viewMode !== 'preview') return

    const zoomAtClientPoint = (clientX: number, clientY: number, nextScaleRaw: number): void => {
      const rect = container.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const pointerX = clientX - rect.left
      const pointerY = clientY - rect.top
      const prevScale = scaleRef.current
      const nextScale = clampScale(nextScaleRaw)
      if (!Number.isFinite(nextScale) || nextScale === prevScale) return
      const ratio = nextScale / prevScale
      const prevTranslate = translateRef.current

      // Keep the point under the cursor fixed while scaling.
      translateRef.current = {
        x: ratio * prevTranslate.x + (1 - ratio) * (pointerX - centerX),
        y: ratio * prevTranslate.y + (1 - ratio) * (pointerY - centerY)
      }
      scaleRef.current = nextScale
    }

    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll
        const factor = Math.exp(-e.deltaY * 0.003)
        zoomAtClientPoint(e.clientX, e.clientY, scaleRef.current * factor)
      } else {
        // Pan via scroll
        translateRef.current = {
          x: translateRef.current.x - e.deltaX,
          y: translateRef.current.y - e.deltaY
        }
      }

      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        applyTransform()
        syncDisplayScale()
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
      cancelAnimationFrame(rafRef.current)
    }
  }, [viewMode, applyTransform, syncDisplayScale])

  // Mouse drag panning — direct DOM
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    translateStart.current = { ...translateRef.current }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return
      translateRef.current = {
        x: translateStart.current.x + (e.clientX - panStart.current.x),
        y: translateStart.current.y + (e.clientY - panStart.current.y)
      }
      applyTransform()
    },
    [applyTransform]
  )

  const handlePointerUp = useCallback(() => {
    isPanning.current = false
  }, [])

  if (!relativePath) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex flex-1 items-center justify-center p-3 text-center text-[0.84rem] text-muted-foreground">
          Open a file from the sidebar.
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {saveError ? (
        <p className="m-0 border-b border-border bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)] px-2.5 py-[0.4rem] text-[0.74rem] text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <button
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[0.75rem] transition-colors ${
            viewMode === 'code'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('code')}
        >
          <Code className="size-3.5" />
          Code
        </button>
        <button
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[0.75rem] transition-colors ${
            viewMode === 'preview'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('preview')}
        >
          <Eye className="size-3.5" />
          Preview
        </button>

        {viewMode === 'preview' && svgOutput ? (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={zoomOut}
              title="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-[3ch] text-center text-[0.7rem] tabular-nums text-muted-foreground">
              {Math.round(displayScale * 100)}%
            </span>
            <button
              className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={zoomIn}
              title="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={fitToPage}
              title="Fit to page"
            >
              <Maximize className="size-3.5" />
            </button>
          </>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        {viewMode === 'code' ? (
          <Editor
            path={relativePath}
            defaultLanguage="markdown"
            value={content}
            onChange={handleEditorChange}
            theme={monacoTheme}
            beforeMount={applyMonacoTheme}
            onMount={(_, monacoApi) => {
              applyMonacoTheme(monacoApi)
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: true,
              automaticLayout: true,
              padding: { top: 8 }
            }}
          />
        ) : (
          <div
            ref={containerRef}
            className="h-full overflow-hidden"
            style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {renderError ? (
              <div className="p-4">
                <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-[0.8rem] text-destructive">
                  <p className="mb-1 font-semibold">Diagram Error</p>
                  <pre className="whitespace-pre-wrap font-mono text-[0.75rem]">{renderError}</pre>
                </div>
              </div>
            ) : svgOutput ? (
              <div
                ref={svgContainerRef}
                className="flex h-full items-center justify-center [&>svg]:max-w-none"
                style={{ transformOrigin: 'center center' }}
                dangerouslySetInnerHTML={{ __html: svgOutput }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[0.84rem] text-muted-foreground">
                {isLoading ? 'Loading...' : 'No diagram content'}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export { MermaidEditor }
