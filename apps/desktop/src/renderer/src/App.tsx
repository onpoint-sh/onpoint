import { useCallback, useEffect, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { getDefaultShortcutProfile, type ShortcutActionId } from '@onpoint/shared/shortcuts'
import { AppShell } from '@/components/layout/app-shell'
import { SearchPalette } from '@/components/search/search-palette'
import { SettingsSidebarNav } from '@/components/layout/settings-sidebar-nav'
import { NotesSidebar } from '@/components/notes/notes-sidebar'
import { IS_DETACHED_WINDOW } from '@/lib/detached-window'
import { isTerminalEditorPath } from '@/lib/terminal-editor-tab'
import { DEFAULT_SETTINGS_SECTION_ID, getSettingsSectionPath } from '@/pages/settings-sections'
import { HomePage } from '@/pages/home-page'
import { SettingsPage } from '@/pages/settings-page'
import { useWindowShortcuts } from '@/shortcuts/use-window-shortcuts'
import { useBottomPanelStore } from '@/stores/bottom-panel-store'
import { useLayoutStore } from '@/stores/layout-store'
import { useNotesStore } from '@/stores/notes-store'
import { usePanesStore } from '@/stores/panes-store'
import { useTerminalStore } from '@/stores/terminal-store'

function App(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
  const initializeNotes = useNotesStore((state) => state.initialize)
  const pickVault = useNotesStore((state) => state.pickVault)

  const [shortcutProfile, setShortcutProfile] = useState(getDefaultShortcutProfile)
  const [isShortcutsLoading, setIsShortcutsLoading] = useState(true)
  const [isGhostMode, setIsGhostMode] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const dispatchShortcutAction = useCallback(
    (actionId: ShortcutActionId, origin: 'window' | 'global' = 'window'): void => {
      const bottomPanelState = useBottomPanelStore.getState()
      const shouldRouteToBottomPanel = bottomPanelState.isOpen && bottomPanelState.isFocused
      const terminalState = useTerminalStore.getState()

      const closeFocusedBottomPanelTab = (): void => {
        const pane = bottomPanelState.getFocusedPane()
        if (!pane?.activeTabId) return
        const tab = pane.tabs.find((candidate) => candidate.id === pane.activeTabId)
        if (tab?.viewId === 'terminal') {
          void terminalState.detachBottomPanelTab(tab.id)
        }
        bottomPanelState.closeTab(pane.id, pane.activeTabId)
      }

      const ensureFocusedTerminalTabId = (): string | null => {
        const latestBottomPanelState = useBottomPanelStore.getState()
        latestBottomPanelState.showAndFocus()

        let pane = latestBottomPanelState.getFocusedPane()
        let activeTabId = pane?.activeTabId ?? null
        let activeTab = activeTabId
          ? (pane?.tabs.find((candidate) => candidate.id === activeTabId) ?? null)
          : null

        if (!activeTab || activeTab.viewId !== 'terminal') {
          latestBottomPanelState.openView('terminal', pane?.id)
          pane = useBottomPanelStore.getState().getFocusedPane()
          activeTabId = pane?.activeTabId ?? null
          activeTab = activeTabId
            ? (pane?.tabs.find((candidate) => candidate.id === activeTabId) ?? null)
            : null
        }

        if (!activeTab || activeTab.viewId !== 'terminal') return null
        return activeTab.id
      }

      const splitActiveBottomTerminal = (direction: 'row' | 'column'): void => {
        const terminalTabId = ensureFocusedTerminalTabId()
        if (!terminalTabId) return

        void (async () => {
          const terminalStore = useTerminalStore.getState()
          await terminalStore.ensureGroupForBottomPanelTab(terminalTabId)
          const group = useTerminalStore.getState().getGroupForBottomPanelTab(terminalTabId)
          const sourceSessionId =
            group?.activeSessionId ??
            useTerminalStore.getState().getSessionIdsForBottomPanelTab(terminalTabId)[0] ??
            null

          if (!sourceSessionId) {
            await useTerminalStore.getState().createSessionInGroup(terminalTabId)
            return
          }

          await useTerminalStore
            .getState()
            .splitSessionInGroup(terminalTabId, sourceSessionId, direction)
        })()
      }

      if (actionId === 'toggle_bottom_panel') {
        if (bottomPanelState.isOpen) {
          bottomPanelState.hidePanel()
        } else {
          bottomPanelState.showAndFocus()
        }
        return
      }

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
        usePanesStore.getState().openUntitledTab()
        usePanesStore.getState().requestEditorFocus()
        return
      }

      if (actionId === 'close_tab') {
        if (shouldRouteToBottomPanel) {
          closeFocusedBottomPanelTab()
          return
        }

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
        if (shouldRouteToBottomPanel) {
          bottomPanelState.cycleTabs('next')
          return
        }

        const panesState = usePanesStore.getState()
        const pane = panesState.getFocusedPane()
        if (!pane || pane.tabs.length <= 1) return
        const currentIndex = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
        const nextIndex = (currentIndex + 1) % pane.tabs.length
        panesState.setActiveTab(pane.id, pane.tabs[nextIndex].id)
        return
      }

      if (actionId === 'prev_tab') {
        if (shouldRouteToBottomPanel) {
          bottomPanelState.cycleTabs('prev')
          return
        }

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

      if (actionId === 'show_main_window' || actionId === 'toggle_ghost_mode') {
        if (origin === 'window') {
          void window.shortcuts.execute(actionId)
        }
        return
      }

      if (actionId === 'search') {
        if (terminalState.isTerminalFocus && terminalState.focusedSessionId) {
          void terminalState.clearBuffer(terminalState.focusedSessionId)
          return
        }
        setIsSearchOpen(true)
        return
      }

      if (actionId === 'new_terminal') {
        bottomPanelState.showAndFocus()
        const terminalTabId = ensureFocusedTerminalTabId()
        if (!terminalTabId) return

        void (async () => {
          const latestTerminalState = useTerminalStore.getState()
          if (latestTerminalState.getSessionIdsForBottomPanelTab(terminalTabId).length > 0) {
            await latestTerminalState.createSessionInGroup(terminalTabId)
          } else {
            await latestTerminalState.ensureGroupForBottomPanelTab(terminalTabId)
          }
        })()
        return
      }

      if (actionId === 'focus_terminal') {
        bottomPanelState.showAndFocus()
        bottomPanelState.openView('terminal')
        return
      }

      if (actionId === 'split_terminal' || actionId === 'split_terminal_right') {
        splitActiveBottomTerminal('row')
        return
      }

      if (actionId === 'split_terminal_down') {
        splitActiveBottomTerminal('column')
        return
      }

      if (actionId === 'clear_terminal') {
        if (terminalState.focusedSessionId) {
          void terminalState.clearBuffer(terminalState.focusedSessionId)
        }
        return
      }

      if (actionId === 'kill_terminal') {
        if (terminalState.focusedSessionId) {
          const focusedSessionId = terminalState.focusedSessionId
          const bottomPanelTabId = terminalState.getBottomPanelTabIdForSession(focusedSessionId)

          void (async () => {
            await useTerminalStore.getState().killSession(focusedSessionId)

            if (!bottomPanelTabId) return
            const group = useTerminalStore.getState().getGroupForBottomPanelTab(bottomPanelTabId)
            if (group) return

            const latestBottomPanelState = useBottomPanelStore.getState()
            for (const pane of Object.values(latestBottomPanelState.panes)) {
              if (!pane.tabs.some((tab) => tab.id === bottomPanelTabId)) continue
              latestBottomPanelState.closeTab(pane.id, bottomPanelTabId)
              break
            }
          })()

          return
        }

        const panesState = usePanesStore.getState()
        const pane = panesState.getFocusedPane()
        const activeTab = pane?.tabs.find((tab) => tab.id === pane.activeTabId)
        if (pane && activeTab && isTerminalEditorPath(activeTab.relativePath)) {
          panesState.closeTab(pane.id, activeTab.id)
          return
        }

        if (shouldRouteToBottomPanel) {
          closeFocusedBottomPanelTab()
        }
      }
    },
    [navigate, pickVault, toggleSidebar]
  )

  useWindowShortcuts({
    profile: shortcutProfile,
    onAction: dispatchShortcutAction,
    searchPaletteVisible: isSearchOpen
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
      usePanesStore.getState().openUntitledTab()
      usePanesStore.getState().requestEditorFocus()
    })
  }, [pickVault])

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
      setShortcutProfile(nextBindings)
    })

    const unsubscribeGlobalAction = window.shortcuts.onGlobalAction((actionId) => {
      dispatchShortcutAction(actionId, 'global')
    })

    void window.shortcuts
      .list()
      .then((nextBindings) => {
        if (!mounted) return
        setShortcutProfile(nextBindings)
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

  useEffect(() => {
    const terminalState = useTerminalStore.getState()
    void terminalState.initialize()

    const consolidateTerminalTabs = (): void => {
      const bottomState = useBottomPanelStore.getState()
      const latestTerminalState = useTerminalStore.getState()

      for (const pane of Object.values(bottomState.panes)) {
        const terminalTabs = pane.tabs.filter((tab) => tab.viewId === 'terminal')
        if (terminalTabs.length <= 1) continue

        const keepTabId =
          pane.activeTabId && terminalTabs.some((tab) => tab.id === pane.activeTabId)
            ? pane.activeTabId
            : terminalTabs[0]?.id

        if (!keepTabId) continue

        for (const tab of terminalTabs) {
          if (tab.id === keepTabId) continue
          latestTerminalState.mergeBottomPanelTabSessions(tab.id, keepTabId)
          bottomState.closeTab(pane.id, tab.id)
        }
      }
    }

    const syncBottomPanelTabs = (): void => {
      consolidateTerminalTabs()
      const bottomState = useBottomPanelStore.getState()
      const terminalTabIds: string[] = []

      for (const pane of Object.values(bottomState.panes)) {
        for (const tab of pane.tabs) {
          if (tab.viewId === 'terminal') {
            terminalTabIds.push(tab.id)
          }
        }
      }

      void useTerminalStore.getState().syncBottomPanelTabIds(terminalTabIds)
    }

    const syncEditorPaths = (): void => {
      const panesState = usePanesStore.getState()
      const terminalPaths: string[] = []

      for (const pane of Object.values(panesState.panes)) {
        for (const tab of pane.tabs) {
          if (tab.relativePath.startsWith('terminal://')) {
            terminalPaths.push(tab.relativePath)
          }
        }
      }

      void useTerminalStore.getState().syncEditorPaths(terminalPaths)
    }

    syncBottomPanelTabs()
    syncEditorPaths()

    const unsubscribeBottom = useBottomPanelStore.subscribe(() => {
      syncBottomPanelTabs()
    })

    const unsubscribePanes = usePanesStore.subscribe(() => {
      syncEditorPaths()
    })

    return () => {
      unsubscribeBottom()
      unsubscribePanes()
    }
  }, [])

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
                  profile={shortcutProfile}
                  isShortcutsLoading={isShortcutsLoading}
                />
              }
            />
            <Route
              path={getSettingsSectionPath('terminal')}
              element={
                <SettingsPage
                  section="terminal"
                  profile={shortcutProfile}
                  isShortcutsLoading={isShortcutsLoading}
                />
              }
            />
            <Route
              path={getSettingsSectionPath('keyboard-shortcuts')}
              element={
                <SettingsPage
                  section="keyboard-shortcuts"
                  profile={shortcutProfile}
                  isShortcutsLoading={isShortcutsLoading}
                />
              }
            />
            <Route
              path={getSettingsSectionPath('ghost-mode')}
              element={
                <SettingsPage
                  section="ghost-mode"
                  profile={shortcutProfile}
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
