import { useCallback, useEffect, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { getDefaultShortcutBindings, type ShortcutActionId } from '@onpoint/shared/shortcuts'
import { AppShell } from '@/components/layout/app-shell'
import { SearchPalette } from '@/components/search/search-palette'
import { SettingsSidebarNav } from '@/components/layout/settings-sidebar-nav'
import { NotesSidebar } from '@/components/notes/notes-sidebar'
import { IS_DETACHED_WINDOW } from '@/lib/detached-window'
import { DEFAULT_SETTINGS_SECTION_ID, getSettingsSectionPath } from '@/pages/settings-sections'
import { HomePage } from '@/pages/home-page'
import { SettingsPage } from '@/pages/settings-page'
import { useWindowShortcuts } from '@/shortcuts/use-window-shortcuts'
import { useLayoutStore } from '@/stores/layout-store'
import { useNotesStore } from '@/stores/notes-store'
import { usePanesStore } from '@/stores/panes-store'

function App(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
  const initializeNotes = useNotesStore((state) => state.initialize)
  const pickVault = useNotesStore((state) => state.pickVault)
  const createNote = useNotesStore((state) => state.createNote)
  const [shortcutBindings, setShortcutBindings] = useState(getDefaultShortcutBindings)
  const [isShortcutsLoading, setIsShortcutsLoading] = useState(true)
  const [isGhostMode, setIsGhostMode] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const dispatchShortcutAction = useCallback(
    (actionId: ShortcutActionId): void => {
      if (actionId === 'toggle_sidebar') {
        toggleSidebar()
        return
      }

      if (actionId === 'open_settings') {
        navigate(getSettingsSectionPath(DEFAULT_SETTINGS_SECTION_ID))
        return
      }

      if (actionId === 'open_folder') {
        void pickVault()
        return
      }

      if (actionId === 'create_note') {
        if (!useNotesStore.getState().config.vaultPath) {
          void pickVault()
          return
        }
        void (async () => {
          const createdPath = await createNote('Inbox')
          if (!createdPath) return
          usePanesStore.getState().requestEditorFocus()
        })()
        return
      }

      if (actionId === 'close_tab') {
        const panesState = usePanesStore.getState()
        const pane = panesState.getFocusedPane()
        if (pane?.activeTabId) {
          panesState.requestCloseTab(pane.id, pane.activeTabId)
        } else {
          void window.windowControls.close()
        }
        return
      }

      if (actionId === 'next_tab') {
        const panesState = usePanesStore.getState()
        const pane = panesState.getFocusedPane()
        if (!pane || pane.tabs.length <= 1) return
        const currentIndex = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
        const nextIndex = (currentIndex + 1) % pane.tabs.length
        panesState.setActiveTab(pane.id, pane.tabs[nextIndex].id)
        return
      }

      if (actionId === 'prev_tab') {
        const panesState = usePanesStore.getState()
        const pane = panesState.getFocusedPane()
        if (!pane || pane.tabs.length <= 1) return
        const currentIndex = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
        const prevIndex = (currentIndex - 1 + pane.tabs.length) % pane.tabs.length
        panesState.setActiveTab(pane.id, pane.tabs[prevIndex].id)
        return
      }

      if (actionId === 'reopen_closed_tab') {
        const panesState = usePanesStore.getState()
        const pane = panesState.getFocusedPane()
        if (!pane) return
        const path = panesState.reopenClosedTab(pane.id)
        if (path) {
          const notes = useNotesStore.getState().notes
          if (notes.some((n) => n.relativePath === path)) {
            panesState.openTab(path, pane.id)
          }
        }
        return
      }

      if (actionId === 'split_pane_right') {
        const panesState = usePanesStore.getState()
        if (panesState.focusedPaneId) {
          panesState.splitPane(panesState.focusedPaneId, 'row')
        }
        return
      }

      if (actionId === 'split_pane_down') {
        const panesState = usePanesStore.getState()
        if (panesState.focusedPaneId) {
          panesState.splitPane(panesState.focusedPaneId, 'column')
        }
        return
      }

      if (actionId === 'zoom_in') {
        void window.windowControls.zoomIn()
        return
      }

      if (actionId === 'zoom_out') {
        void window.windowControls.zoomOut()
        return
      }

      if (actionId === 'zoom_reset') {
        void window.windowControls.resetZoom()
        return
      }

      if (actionId === 'new_window') {
        void window.windowControls.newWindow()
        return
      }

      if (actionId === 'search') {
        setIsSearchOpen(true)
      }
    },
    [createNote, navigate, pickVault, toggleSidebar]
  )

  useWindowShortcuts({
    bindings: shortcutBindings,
    onAction: dispatchShortcutAction
  })

  useEffect(() => {
    void window.ghostMode.getState().then(setIsGhostMode)
    return window.ghostMode.onStateChanged(setIsGhostMode)
  }, [])

  useEffect(() => {
    void initializeNotes()
  }, [initializeNotes])

  useEffect(() => {
    return window.menuEvents.onTriggerPickVault(() => {
      void pickVault()
    })
  }, [pickVault])

  useEffect(() => {
    return window.menuEvents.onTriggerCreateNote(() => {
      if (!useNotesStore.getState().config.vaultPath) {
        void pickVault()
        return
      }
      void (async () => {
        const createdPath = await createNote('Inbox')
        if (!createdPath) return
        usePanesStore.getState().requestEditorFocus()
      })()
    })
  }, [createNote, pickVault])

  // Detached window: fetch init data and open the tab
  useEffect(() => {
    if (!IS_DETACHED_WINDOW) return
    void window.windowControls.getDetachInit().then((data) => {
      if (data) {
        usePanesStore.getState().openTab(data.relativePath)
      }
    })
  }, [])

  useEffect(() => {
    let mounted = true

    const unsubscribeBindingsChanged = window.shortcuts.onBindingsChanged((nextBindings) => {
      if (!mounted) return
      setShortcutBindings(nextBindings)
    })

    const unsubscribeGlobalAction = window.shortcuts.onGlobalAction((actionId) => {
      dispatchShortcutAction(actionId)
    })

    void window.shortcuts
      .list()
      .then((nextBindings) => {
        if (!mounted) return
        setShortcutBindings(nextBindings)
      })
      .catch((error) => {
        console.error('Failed to load shortcut bindings.', error)
      })
      .finally(() => {
        if (!mounted) return
        setIsShortcutsLoading(false)
      })

    return () => {
      mounted = false
      unsubscribeBindingsChanged()
      unsubscribeGlobalAction()
    }
  }, [dispatchShortcutAction])

  const sidebarContent = IS_DETACHED_WINDOW ? undefined : location.pathname.startsWith(
      '/settings'
    ) ? (
    <SettingsSidebarNav />
  ) : (
    <NotesSidebar />
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <AppShell
        sidebarContent={sidebarContent}
        onOpenSearch={() => setIsSearchOpen(true)}
        isGhostMode={isGhostMode}
      >
        {IS_DETACHED_WINDOW ? (
          <HomePage />
        ) : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/settings"
              element={
                <Navigate to={getSettingsSectionPath(DEFAULT_SETTINGS_SECTION_ID)} replace />
              }
            />
            <Route
              path={getSettingsSectionPath('appearance')}
              element={
                <SettingsPage
                  section="appearance"
                  bindings={shortcutBindings}
                  isShortcutsLoading={isShortcutsLoading}
                />
              }
            />
            <Route
              path={getSettingsSectionPath('keyboard-shortcuts')}
              element={
                <SettingsPage
                  section="keyboard-shortcuts"
                  bindings={shortcutBindings}
                  isShortcutsLoading={isShortcutsLoading}
                />
              }
            />
            <Route
              path={getSettingsSectionPath('ghost-mode')}
              element={
                <SettingsPage
                  section="ghost-mode"
                  bindings={shortcutBindings}
                  isShortcutsLoading={isShortcutsLoading}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </AppShell>
      {isSearchOpen && <SearchPalette onClose={() => setIsSearchOpen(false)} />}
    </DndProvider>
  )
}

export default App
