import { useCallback, useEffect, useRef, useState } from 'react'
import { MosaicWithoutDragDropContext } from 'react-mosaic-component'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {
  ChevronRight,
  FolderOpen,
  PanelLeft,
  Search,
  Settings,
  FilePlus2,
  FolderPlus
} from 'lucide-react'
import { usePreviewStore } from '../store'
import { useAppPreview } from '../context'
import { EditorPane } from './editor-pane'
import { PreviewSidebar, type PreviewSidebarHandle } from './preview-sidebar'
import { SearchPalette } from './search-palette'

import 'react-mosaic-component/react-mosaic-component.css'

type AppPreviewProps = {
  height?: number
  defaultNote?: string
  initialSearchOpen?: boolean
  showSidebar?: boolean
}

export function AppPreview({
  height = 600,
  defaultNote,
  initialSearchOpen = false,
  showSidebar = true
}: AppPreviewProps): React.JSX.Element {
  const { notes } = useAppPreview()
  const layout = usePreviewStore((s) => s.layout)
  const updateLayout = usePreviewStore((s) => s.updateLayout)
  const createPane = usePreviewStore((s) => s.createPane)
  const [sidebarOpen, setSidebarOpen] = useState(
    showSidebar && (typeof window !== 'undefined' ? window.innerWidth >= 640 : true)
  )
  const [isSearchOpen, setIsSearchOpen] = useState(initialSearchOpen)
  const initializedRef = useRef(false)
  const sidebarRef = useRef<PreviewSidebarHandle>(null)
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)

  // Initialize with default note on first render
  useEffect(() => {
    if (initializedRef.current || notes.length === 0) return
    initializedRef.current = true

    const notePath = defaultNote ?? notes[0].relativePath
    createPane(notePath)
  }, [notes, defaultNote, createPane])

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    if (!containerEl) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    containerEl.addEventListener('keydown', handleKeyDown)
    return () => containerEl.removeEventListener('keydown', handleKeyDown)
  }, [containerEl])

  const renderTile = useCallback((id: string) => <EditorPane paneId={id} />, [])

  const sidebarWidth = 220
  const contentHeight = height - 36 // subtract title bar height

  return (
    <div ref={setContainerEl} className="app-preview-container" style={{ height }}>
      {containerEl ? (
        <DndProvider backend={HTML5Backend} options={{ rootElement: containerEl }}>
          {/* Title Bar */}
          <div className="app-preview-titlebar">
            <div className="app-preview-traffic-lights">
              <div className="app-preview-dot app-preview-dot-red" />
              <div className="app-preview-dot app-preview-dot-yellow" />
              <div className="app-preview-dot app-preview-dot-green" />
            </div>
            <div className="app-preview-titlebar-actions">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="app-preview-titlebar-btn"
              >
                <PanelLeft style={{ width: 14, height: 14 }} />
              </button>
              <button
                type="button"
                className="app-preview-titlebar-btn"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ flex: 1 }} />
            <span className="app-preview-titlebar-label">OnPoint</span>
            <div style={{ flex: 1 }} />
            <div style={{ width: 72 }} />
          </div>

          <div style={{ display: 'flex', height: contentHeight }}>
            {/* Sidebar */}
            {sidebarOpen && (
              <div className="app-preview-sidebar" style={{ width: sidebarWidth }}>
                {/* Vault Header */}
                <div className="app-preview-sidebar-header">
                  <button type="button" className="app-preview-sidebar-header-btn">
                    <ChevronRight style={{ transform: 'rotate(90deg)' }} />
                    NOTES
                  </button>
                  <div className="app-preview-sidebar-actions">
                    <button
                      type="button"
                      className="app-preview-sidebar-action-btn"
                      onClick={() => sidebarRef.current?.createLeaf()}
                    >
                      <FilePlus2 />
                    </button>
                    <button
                      type="button"
                      className="app-preview-sidebar-action-btn"
                      onClick={() => sidebarRef.current?.createInternal()}
                    >
                      <FolderPlus />
                    </button>
                  </div>
                </div>

                <div className="app-preview-sidebar-tree">
                  <PreviewSidebar ref={sidebarRef} height={contentHeight - 32 - 36} />
                </div>

                {/* Settings */}
                <div className="app-preview-sidebar-footer">
                  <button type="button" className="app-preview-sidebar-footer-btn">
                    <Settings />
                    Settings
                  </button>
                </div>
              </div>
            )}

            {/* Main Content — Mosaic */}
            <div className="mosaic-container" style={{ flex: 1, overflow: 'hidden' }}>
              {layout ? (
                <MosaicWithoutDragDropContext<string>
                  renderTile={renderTile}
                  value={layout}
                  onChange={(newLayout) => {
                    if (newLayout) updateLayout(newLayout)
                  }}
                />
              ) : (
                <div className="app-preview-empty-state">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <FolderOpen
                      style={{
                        width: 32,
                        height: 32,
                        color: 'var(--muted-foreground)',
                        opacity: 0.4
                      }}
                    />
                    <span>Open a note from the sidebar</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isSearchOpen && <SearchPalette onClose={() => setIsSearchOpen(false)} />}
        </DndProvider>
      ) : null}
    </div>
  )
}
