import { createContext, useContext } from 'react'
import { createStore, useStore } from 'zustand'
import type { MosaicNode, MosaicDirection, MosaicBranch } from 'react-mosaic-component'
import { getLeaves, createRemoveUpdate, updateTree } from 'react-mosaic-component'
import type { PaneTab, Pane } from './types'

export type PreviewStoreState = {
  layout: MosaicNode<string> | null
  panes: Record<string, Pane>
  focusedPaneId: string | null

  createPane: (relativePath: string) => string
  splitPane: (paneId: string, direction: MosaicDirection) => string | null
  splitPaneWithTab: (
    targetPaneId: string,
    direction: MosaicDirection,
    position: 'first' | 'second',
    fromPaneId: string,
    tabId: string
  ) => void
  closePane: (paneId: string) => void
  setFocusedPane: (paneId: string) => void
  updateLayout: (layout: MosaicNode<string> | null) => void

  openTab: (relativePath: string, paneId?: string) => string
  closeTab: (paneId: string, tabId: string) => void
  setActiveTab: (paneId: string, tabId: string) => void
  reorderTab: (paneId: string, fromIndex: number, toIndex: number) => void
  moveTabToPane: (fromPaneId: string, tabId: string, toPaneId: string) => void
}

function createPaneId(): string {
  return `pane-${crypto.randomUUID()}`
}

function createTabId(): string {
  return `tab-${crypto.randomUUID()}`
}

function pickNextActiveTab(tabs: PaneTab[], closedIndex: number): string | null {
  if (tabs.length === 0) return null
  const nextIndex = closedIndex < tabs.length ? closedIndex : tabs.length - 1
  return tabs[nextIndex].id
}

function findPaneIdInLayout(
  layout: MosaicNode<string> | null,
  paneId: string
): MosaicBranch[] | null {
  if (layout === null) return null
  if (typeof layout === 'string') {
    return layout === paneId ? [] : null
  }
  const firstPath = findPaneIdInLayout(layout.first, paneId)
  if (firstPath !== null) return ['first' as MosaicBranch, ...firstPath]
  const secondPath = findPaneIdInLayout(layout.second, paneId)
  if (secondPath !== null) return ['second' as MosaicBranch, ...secondPath]
  return null
}

function removePaneFromLayout(
  layout: MosaicNode<string> | null,
  paneId: string
): MosaicNode<string> | null {
  if (layout === null) return null
  if (typeof layout === 'string') {
    return layout === paneId ? null : layout
  }
  const path = findPaneIdInLayout(layout, paneId)
  if (path === null) return layout
  const update = createRemoveUpdate(layout, path)
  return updateTree(layout, [update])
}

function replaceAtPath(
  tree: MosaicNode<string>,
  path: MosaicBranch[],
  replacement: MosaicNode<string>
): MosaicNode<string> {
  if (path.length === 0) return replacement
  if (typeof tree === 'string') return tree
  const [head, ...rest] = path
  if (head === 'first') {
    return { ...tree, first: replaceAtPath(tree.first, rest, replacement) }
  }
  if (head === 'second') {
    return { ...tree, second: replaceAtPath(tree.second, rest, replacement) }
  }
  return tree
}

export type PreviewStore = ReturnType<typeof createPreviewStore>

export function createPreviewStore(): ReturnType<typeof createStore<PreviewStoreState>> {
  return createStore<PreviewStoreState>()((set, get) => ({
    layout: null,
    panes: {},
    focusedPaneId: null,

    createPane: (relativePath: string) => {
      const paneId = createPaneId()
      const tabId = createTabId()
      const tab: PaneTab = { id: tabId, relativePath }
      const pane: Pane = { id: paneId, tabs: [tab], activeTabId: tabId }

      const state = get()
      const newLayout =
        state.layout === null
          ? paneId
          : { direction: 'row' as MosaicDirection, first: state.layout, second: paneId }

      set({
        layout: newLayout,
        panes: { ...state.panes, [paneId]: pane },
        focusedPaneId: paneId
      })
      return paneId
    },

    splitPane: (paneId: string, direction: MosaicDirection) => {
      const state = get()
      const pane = state.panes[paneId]
      if (!pane) return null

      const path = findPaneIdInLayout(state.layout, paneId)
      if (path === null) return null

      const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId)
      const relativePath = activeTab?.relativePath ?? pane.tabs[0]?.relativePath
      if (!relativePath) return null

      const newPaneId = createPaneId()
      const newTabId = createTabId()
      const newTab: PaneTab = { id: newTabId, relativePath }
      const newPane: Pane = { id: newPaneId, tabs: [newTab], activeTabId: newTabId }

      const splitNode: MosaicNode<string> = {
        direction,
        first: paneId,
        second: newPaneId,
        splitPercentage: 50
      }

      const newLayout =
        path.length === 0 ? splitNode : replaceAtPath(state.layout!, path, splitNode)

      set({
        layout: newLayout,
        panes: { ...state.panes, [newPaneId]: newPane },
        focusedPaneId: newPaneId
      })
      return newPaneId
    },

    splitPaneWithTab: (
      targetPaneId: string,
      direction: MosaicDirection,
      position: 'first' | 'second',
      fromPaneId: string,
      tabId: string
    ) => {
      const state = get()
      const fromPane = state.panes[fromPaneId]
      if (!fromPane) return

      const tab = fromPane.tabs.find((t) => t.id === tabId)
      if (!tab) return

      const targetPath = findPaneIdInLayout(state.layout, targetPaneId)
      if (targetPath === null) return

      // Create new pane with the dragged tab
      const newPaneId = createPaneId()
      const newTabId = createTabId()
      const newTab: PaneTab = { id: newTabId, relativePath: tab.relativePath }
      const newPane: Pane = { id: newPaneId, tabs: [newTab], activeTabId: newTabId }

      const splitNode: MosaicNode<string> = {
        direction,
        first: position === 'first' ? newPaneId : targetPaneId,
        second: position === 'second' ? newPaneId : targetPaneId,
        splitPercentage: 50
      }

      let newLayout: MosaicNode<string> =
        targetPath.length === 0 ? splitNode : replaceAtPath(state.layout!, targetPath, splitNode)

      const newPanes = { ...state.panes, [newPaneId]: newPane }

      // Remove tab from source pane (skip if it's the last tab in the same pane we just split)
      if (!(fromPaneId === targetPaneId && fromPane.tabs.length === 1)) {
        const fromTabs = fromPane.tabs.filter((t) => t.id !== tabId)
        if (fromTabs.length === 0) {
          delete newPanes[fromPaneId]
          newLayout = removePaneFromLayout(newLayout, fromPaneId) ?? newLayout
        } else {
          const fromIndex = fromPane.tabs.findIndex((t) => t.id === tabId)
          const fromActiveTabId =
            fromPane.activeTabId === tabId
              ? pickNextActiveTab(fromTabs, fromIndex)
              : fromPane.activeTabId

          newPanes[fromPaneId] = { ...fromPane, tabs: fromTabs, activeTabId: fromActiveTabId }
        }
      }

      set({ layout: newLayout, panes: newPanes, focusedPaneId: newPaneId })
    },

    closePane: (paneId: string) => {
      const state = get()
      if (!state.panes[paneId]) return

      const newLayout = removePaneFromLayout(state.layout, paneId)
      const newPanes = { ...state.panes }
      delete newPanes[paneId]

      let newFocusedPaneId = state.focusedPaneId
      if (newFocusedPaneId === paneId) {
        const remainingPaneIds = newLayout ? getLeaves(newLayout) : []
        newFocusedPaneId = remainingPaneIds[0] ?? null
      }

      set({ layout: newLayout, panes: newPanes, focusedPaneId: newFocusedPaneId })
    },

    setFocusedPane: (paneId: string) => {
      if (get().panes[paneId]) set({ focusedPaneId: paneId })
    },

    updateLayout: (layout: MosaicNode<string> | null) => {
      set({ layout })
    },

    openTab: (relativePath: string, paneId?: string) => {
      const state = get()
      const targetPaneId = paneId ?? state.focusedPaneId

      if (!targetPaneId || !state.panes[targetPaneId]) {
        return get().createPane(relativePath)
      }

      const pane = state.panes[targetPaneId]

      // Check if tab already open
      const existing = pane.tabs.find((t) => t.relativePath === relativePath)
      if (existing) {
        set({
          panes: {
            ...state.panes,
            [targetPaneId]: { ...pane, activeTabId: existing.id }
          },
          focusedPaneId: targetPaneId
        })
        return targetPaneId
      }

      // Create new tab
      const tabId = createTabId()
      const newTab: PaneTab = { id: tabId, relativePath }
      set({
        panes: {
          ...state.panes,
          [targetPaneId]: {
            ...pane,
            tabs: [...pane.tabs, newTab],
            activeTabId: tabId
          }
        },
        focusedPaneId: targetPaneId
      })
      return targetPaneId
    },

    closeTab: (paneId: string, tabId: string) => {
      const state = get()
      const pane = state.panes[paneId]
      if (!pane) return

      const index = pane.tabs.findIndex((t) => t.id === tabId)
      if (index === -1) return

      const nextTabs = pane.tabs.filter((t) => t.id !== tabId)

      if (nextTabs.length === 0) {
        get().closePane(paneId)
        return
      }

      const nextActiveTabId =
        pane.activeTabId === tabId ? pickNextActiveTab(nextTabs, index) : pane.activeTabId

      set({
        panes: {
          ...state.panes,
          [paneId]: { ...pane, tabs: nextTabs, activeTabId: nextActiveTabId }
        }
      })
    },

    setActiveTab: (paneId: string, tabId: string) => {
      const state = get()
      const pane = state.panes[paneId]
      if (!pane || !pane.tabs.some((t) => t.id === tabId)) return

      set({
        panes: {
          ...state.panes,
          [paneId]: { ...pane, activeTabId: tabId }
        }
      })
    },

    reorderTab: (paneId: string, fromIndex: number, toIndex: number) => {
      const state = get()
      const pane = state.panes[paneId]
      if (!pane) return
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        fromIndex >= pane.tabs.length ||
        toIndex < 0 ||
        toIndex >= pane.tabs.length
      ) {
        return
      }

      const fromPinned = Boolean(pane.tabs[fromIndex].pinned)
      const toPinned = Boolean(pane.tabs[toIndex].pinned)
      if (fromPinned !== toPinned) return

      const nextTabs = [...pane.tabs]
      const [moved] = nextTabs.splice(fromIndex, 1)
      nextTabs.splice(toIndex, 0, moved)

      set({
        panes: {
          ...state.panes,
          [paneId]: { ...pane, tabs: nextTabs }
        }
      })
    },

    moveTabToPane: (fromPaneId: string, tabId: string, toPaneId: string) => {
      const state = get()
      const fromPane = state.panes[fromPaneId]
      const toPane = state.panes[toPaneId]
      if (!fromPane || !toPane) return

      const tab = fromPane.tabs.find((t) => t.id === tabId)
      if (!tab) return

      const fromTabs = fromPane.tabs.filter((t) => t.id !== tabId)
      const fromIndex = fromPane.tabs.findIndex((t) => t.id === tabId)

      const newPanes = { ...state.panes }

      // Add to target pane
      newPanes[toPaneId] = {
        ...toPane,
        tabs: [...toPane.tabs, tab],
        activeTabId: tab.id
      }

      // Remove from source pane
      if (fromTabs.length === 0) {
        delete newPanes[fromPaneId]
        const newLayout = removePaneFromLayout(state.layout, fromPaneId)
        set({ layout: newLayout, panes: newPanes, focusedPaneId: toPaneId })
      } else {
        const fromActiveTabId =
          fromPane.activeTabId === tabId
            ? pickNextActiveTab(fromTabs, fromIndex)
            : fromPane.activeTabId

        newPanes[fromPaneId] = { ...fromPane, tabs: fromTabs, activeTabId: fromActiveTabId }
        set({ panes: newPanes, focusedPaneId: toPaneId })
      }
    }
  }))
}

// Context for per-instance stores
export const PreviewStoreContext = createContext<PreviewStore | null>(null)

export function usePreviewStore<T>(selector: (state: PreviewStoreState) => T): T {
  const store = useContext(PreviewStoreContext)
  if (!store) throw new Error('usePreviewStore must be used within a PreviewStoreContext.Provider')
  return useStore(store, selector)
}

export function usePreviewStoreApi(): PreviewStore {
  const store = useContext(PreviewStoreContext)
  if (!store)
    throw new Error('usePreviewStoreApi must be used within a PreviewStoreContext.Provider')
  return store
}
