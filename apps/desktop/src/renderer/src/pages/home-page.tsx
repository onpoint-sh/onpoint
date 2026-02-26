import { useCallback } from 'react'
import { Mosaic, type MosaicNode } from 'react-mosaic-component'
import { useDragDropManager } from 'react-dnd'
import { FolderOpen, FilePlus2, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import 'react-mosaic-component/react-mosaic-component.css'
import { isUntitledPath } from '@onpoint/shared/notes'
import { usePanesStore, forceWindowClose } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'
import { DEFAULT_SETTINGS_SECTION_ID, getSettingsSectionPath } from '@/pages/settings-sections'
import { EditorPane } from '@/components/notes/editor-pane'
import { CloseConfirmDialog } from '@/components/notes/pane-tab-bar'
import { tabSaveCallbacks } from '@/lib/tab-save-callbacks'

function WelcomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const pickVault = useNotesStore((s) => s.pickVault)
  const config = useNotesStore((s) => s.config)
  const createNote = useNotesStore((s) => s.createNote)

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex max-w-[22rem] flex-col gap-5">
        <div>
          <h1
            className="m-0 text-[1.6rem] font-[300] leading-tight"
            style={{ color: 'var(--foreground)' }}
          >
            Onpoint
          </h1>
          <p
            className="m-0 mt-0.5 text-[0.82rem] font-[400]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Markdown notes, captured fast
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p
            className="m-0 mb-1 text-[0.78rem] font-[600] uppercase tracking-wide"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Start
          </p>
          {config.vaultPath ? (
            <button
              type="button"
              className="welcome-link"
              onClick={() => void createNote()}
            >
              <FilePlus2 className="size-[1.05rem]" />
              New Note…
            </button>
          ) : null}
          <button
            type="button"
            className="welcome-link"
            onClick={() => void pickVault()}
          >
            <FolderOpen className="size-[1.05rem]" />
            Open…
          </button>
          <button
            type="button"
            className="welcome-link"
            onClick={() => navigate(getSettingsSectionPath(DEFAULT_SETTINGS_SECTION_ID))}
          >
            <Settings className="size-[1.05rem]" />
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function TabCloseGuard(): React.JSX.Element | null {
  const pendingCloseTab = usePanesStore((s) => s.pendingCloseTab)
  const panes = usePanesStore((s) => s.panes)
  const setPendingCloseTab = usePanesStore((s) => s.setPendingCloseTab)
  const closeTab = usePanesStore((s) => s.closeTab)
  const notes = useNotesStore((s) => s.notes)

  const handleSave = useCallback(async () => {
    if (!pendingCloseTab) return
    const { paneId, tabId } = pendingCloseTab
    const cb = tabSaveCallbacks.get(tabId)
    if (cb) {
      const saved = await cb()
      if (!saved) return // User cancelled Save As dialog
    }
    closeTab(paneId, tabId)
    setPendingCloseTab(null)
  }, [pendingCloseTab, closeTab, setPendingCloseTab])

  const handleDontSave = useCallback(() => {
    if (!pendingCloseTab) return
    closeTab(pendingCloseTab.paneId, pendingCloseTab.tabId)
    setPendingCloseTab(null)
  }, [pendingCloseTab, closeTab, setPendingCloseTab])

  const handleCancel = useCallback(() => {
    setPendingCloseTab(null)
  }, [setPendingCloseTab])

  if (!pendingCloseTab) return null

  // Resolve label
  const pane = panes[pendingCloseTab.paneId]
  const tab = pane?.tabs.find((t) => t.id === pendingCloseTab.tabId)
  let label = 'Untitled'
  if (tab && !isUntitledPath(tab.relativePath)) {
    const note = notes.find((n) => n.relativePath === tab.relativePath)
    if (note) {
      label = note.title
    } else {
      const parts = tab.relativePath.split('/')
      label = parts[parts.length - 1].replace(/\.md$/, '')
    }
  }

  return (
    <CloseConfirmDialog
      label={label}
      onSave={handleSave}
      onDontSave={handleDontSave}
      onCancel={handleCancel}
    />
  )
}

function WindowCloseGuard(): React.JSX.Element | null {
  const windowCloseRequested = usePanesStore((s) => s.windowCloseRequested)
  const setWindowCloseRequested = usePanesStore((s) => s.setWindowCloseRequested)

  const handleSave = useCallback(async () => {
    // Save all dirty tabs, then force close
    const { dirtyTabs, panes } = usePanesStore.getState()
    const dirtyIds = Object.keys(dirtyTabs)

    for (const tabId of dirtyIds) {
      const cb = tabSaveCallbacks.get(tabId)
      if (cb) {
        const saved = await cb()
        if (!saved) {
          // User cancelled a Save As dialog — abort the close
          setWindowCloseRequested(false)
          return
        }
      }
    }

    // Also flush any non-dirty saved notes that might have pending autosave
    for (const pane of Object.values(panes)) {
      for (const tab of pane.tabs) {
        const cb = tabSaveCallbacks.get(tab.id)
        if (cb && !dirtyTabs[tab.id]) {
          await cb().catch(() => {})
        }
      }
    }

    forceWindowClose()
  }, [setWindowCloseRequested])

  const handleDontSave = useCallback(() => {
    forceWindowClose()
  }, [])

  const handleCancel = useCallback(() => {
    setWindowCloseRequested(false)
  }, [setWindowCloseRequested])

  if (!windowCloseRequested) return null

  return (
    <CloseConfirmDialog
      label="this window"
      onSave={handleSave}
      onDontSave={handleDontSave}
      onCancel={handleCancel}
    />
  )
}

function HomePage(): React.JSX.Element {
  const layout = usePanesStore((s) => s.layout)
  const updateLayout = usePanesStore((s) => s.updateLayout)
  const config = useNotesStore((s) => s.config)
  const dndManager = useDragDropManager()

  const handleChange = useCallback(
    (newLayout: MosaicNode<string> | null) => {
      updateLayout(newLayout)
    },
    [updateLayout]
  )

  const renderTile = useCallback((paneId: string) => {
    return <EditorPane paneId={paneId} />
  }, [])

  if (!config.vaultPath || layout === null) {
    return <WelcomePage />
  }

  return (
    <>
      <div className="mosaic-container h-full">
        <Mosaic<string>
          renderTile={renderTile}
          value={layout}
          onChange={handleChange}
          dragAndDropManager={dndManager}
          className=""
        />
      </div>
      <TabCloseGuard />
      <WindowCloseGuard />
    </>
  )
}

export { HomePage }
