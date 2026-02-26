import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MosaicNode, MosaicDirection, MosaicBranch } from 'react-mosaic-component'
import { getLeaves, createRemoveUpdate, updateTree } from 'react-mosaic-component'
import { WINDOW_ID } from '@/lib/detached-window'

// Migrate old unkeyed localStorage to keyed format for the "main" window
if (WINDOW_ID === 'main') {
  const keyedKey = 'onpoint.panes.v1.main'
  const unkeyedKey = 'onpoint.panes.v1'
  if (!localStorage.getItem(keyedKey) && localStorage.getItem(unkeyedKey)) {
    localStorage.setItem(keyedKey, localStorage.getItem(unkeyedKey)!)
    localStorage.removeItem(unkeyedKey)
  }
}

export type PaneTab = {
  id: string
  relativePath: string
}

export type Pane = {
  id: string
  tabs: PaneTab[]
  activeTabId: string | null
  recentlyClosedPaths: string[]
}

const MAX_RECENTLY_CLOSED = 10

type PersistedPanesState = {
  layout: MosaicNode<string> | null
  panes: Record<string, Pane>
  focusedPaneId: string | null
}

export type PanesStoreState = {
  layout: MosaicNode<string> | null
  panes: Record<string, Pane>
  focusedPaneId: string | null

  // Pane operations
  createPane: (relativePath: string) => string
  splitPane: (paneId: string, direction: MosaicDirection) => string | null
  closePane: (paneId: string) => void
  setFocusedPane: (paneId: string) => void
  updateLayout: (layout: MosaicNode<string> | null) => void

  splitPaneWithTab: (
    targetPaneId: string,
    direction: MosaicDirection,
    position: 'first' | 'second',
    fromPaneId: string,
    tabId: string
  ) => void

  // Tab operations
  openTab: (relativePath: string, paneId?: string) => string
  closeTab: (paneId: string, tabId: string) => void
  closeOtherTabs: (paneId: string, tabId: string) => void
  setActiveTab: (paneId: string, tabId: string) => void
  reorderTab: (paneId: string, fromIndex: number, toIndex: number) => void
  reopenClosedTab: (paneId: string) => string | null
  moveTabToPane: (fromPaneId: string, tabId: string, toPaneId: string) => void

  // Cross-cutting
  removeTabsByPath: (relativePath: string) => void
  updateTabPath: (oldPath: string, newPath: string) => void
  validatePanes: (existingPaths: Set<string>) => void
  getFocusedPane: () => Pane | null
  getActiveTabInFocusedPane: () => PaneTab | null
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

export const usePanesStore = create<PanesStoreState>()(
  persist(
    (set, get) => ({
      layout: null,
      panes: {},
      focusedPaneId: null,

      createPane: (relativePath: string) => {
        const paneId = createPaneId()
        const tabId = createTabId()
        const tab: PaneTab = { id: tabId, relativePath }
        const pane: Pane = {
          id: paneId,
          tabs: [tab],
          activeTabId: tabId,
          recentlyClosedPaths: []
        }

        const state = get()
        const newLayout = state.layout === null
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
        const newPane: Pane = {
          id: newPaneId,
          tabs: [newTab],
          activeTabId: newTabId,
          recentlyClosedPaths: []
        }

        const splitNode: MosaicNode<string> = {
          direction,
          first: paneId,
          second: newPaneId,
          splitPercentage: 50
        }

        let newLayout: MosaicNode<string>
        if (path.length === 0) {
          newLayout = splitNode
        } else {
          // Replace the paneId node at the path with the split node
          newLayout = replaceAtPath(state.layout!, path, splitNode)
        }

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
        const newPane: Pane = {
          id: newPaneId,
          tabs: [newTab],
          activeTabId: newTabId,
          recentlyClosedPaths: []
        }

        // Build the split node
        const splitNode: MosaicNode<string> = {
          direction,
          first: position === 'first' ? newPaneId : targetPaneId,
          second: position === 'second' ? newPaneId : targetPaneId,
          splitPercentage: 50
        }

        let newLayout: MosaicNode<string>
        if (targetPath.length === 0) {
          newLayout = splitNode
        } else {
          newLayout = replaceAtPath(state.layout!, targetPath, splitNode)
        }

        const newPanes = { ...state.panes, [newPaneId]: newPane }

        // Remove tab from source pane
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

          newPanes[fromPaneId] = {
            ...fromPane,
            tabs: fromTabs,
            activeTabId: fromActiveTabId
          }
        }

        set({
          layout: newLayout,
          panes: newPanes,
          focusedPaneId: newPaneId
        })
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

        set({
          layout: newLayout,
          panes: newPanes,
          focusedPaneId: newFocusedPaneId
        })
      },

      setFocusedPane: (paneId: string) => {
        const state = get()
        if (state.panes[paneId]) {
          set({ focusedPaneId: paneId })
        }
      },

      updateLayout: (layout: MosaicNode<string> | null) => {
        set({ layout })
      },

      openTab: (relativePath: string, paneId?: string) => {
        const state = get()
        const targetPaneId = paneId ?? state.focusedPaneId

        // If no pane exists, create one
        if (!targetPaneId || !state.panes[targetPaneId]) {
          return get().createPane(relativePath)
        }

        const pane = state.panes[targetPaneId]

        // Check if tab already exists in this pane
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

        const closingTab = pane.tabs[index]
        const nextTabs = pane.tabs.filter((t) => t.id !== tabId)

        // If last tab, close the pane
        if (nextTabs.length === 0) {
          // Add to recently closed before closing pane
          const updatedPanes = { ...state.panes }
          updatedPanes[paneId] = {
            ...pane,
            recentlyClosedPaths: [
              ...pane.recentlyClosedPaths,
              closingTab.relativePath
            ].slice(-MAX_RECENTLY_CLOSED)
          }
          set({ panes: updatedPanes })
          get().closePane(paneId)
          return
        }

        const nextActiveTabId =
          pane.activeTabId === tabId
            ? pickNextActiveTab(nextTabs, index)
            : pane.activeTabId

        const recentlyClosedPaths = [
          ...pane.recentlyClosedPaths,
          closingTab.relativePath
        ].slice(-MAX_RECENTLY_CLOSED)

        set({
          panes: {
            ...state.panes,
            [paneId]: {
              ...pane,
              tabs: nextTabs,
              activeTabId: nextActiveTabId,
              recentlyClosedPaths
            }
          }
        })
      },

      closeOtherTabs: (paneId: string, tabId: string) => {
        const state = get()
        const pane = state.panes[paneId]
        if (!pane) return

        const kept = pane.tabs.find((t) => t.id === tabId)
        if (!kept) return

        const closedPaths = pane.tabs
          .filter((t) => t.id !== tabId)
          .map((t) => t.relativePath)

        const recentlyClosedPaths = [
          ...pane.recentlyClosedPaths,
          ...closedPaths
        ].slice(-MAX_RECENTLY_CLOSED)

        set({
          panes: {
            ...state.panes,
            [paneId]: {
              ...pane,
              tabs: [kept],
              activeTabId: tabId,
              recentlyClosedPaths
            }
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

      reopenClosedTab: (paneId: string) => {
        const state = get()
        const pane = state.panes[paneId]
        if (!pane || pane.recentlyClosedPaths.length === 0) return null

        const nextRecentlyClosedPaths = [...pane.recentlyClosedPaths]
        const path = nextRecentlyClosedPaths.pop()!

        set({
          panes: {
            ...state.panes,
            [paneId]: { ...pane, recentlyClosedPaths: nextRecentlyClosedPaths }
          }
        })

        return path
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
          // Source pane becomes empty, close it
          delete newPanes[fromPaneId]
          const newLayout = removePaneFromLayout(state.layout, fromPaneId)
          let newFocusedPaneId = toPaneId
          set({ layout: newLayout, panes: newPanes, focusedPaneId: newFocusedPaneId })
        } else {
          const fromActiveTabId =
            fromPane.activeTabId === tabId
              ? pickNextActiveTab(fromTabs, fromIndex)
              : fromPane.activeTabId

          newPanes[fromPaneId] = {
            ...fromPane,
            tabs: fromTabs,
            activeTabId: fromActiveTabId
          }
          set({ panes: newPanes, focusedPaneId: toPaneId })
        }
      },

      removeTabsByPath: (relativePath: string) => {
        const state = get()
        const newPanes = { ...state.panes }
        const panesToClose: string[] = []

        for (const [paneId, pane] of Object.entries(newPanes)) {
          const filteredTabs = pane.tabs.filter((t) => t.relativePath !== relativePath)

          if (filteredTabs.length === 0) {
            panesToClose.push(paneId)
          } else if (filteredTabs.length !== pane.tabs.length) {
            const closedIndex = pane.tabs.findIndex((t) => t.relativePath === relativePath)
            const nextActiveTabId =
              pane.activeTabId &&
              pane.tabs.find((t) => t.id === pane.activeTabId)?.relativePath === relativePath
                ? pickNextActiveTab(filteredTabs, closedIndex)
                : pane.activeTabId

            newPanes[paneId] = {
              ...pane,
              tabs: filteredTabs,
              activeTabId: nextActiveTabId
            }
          }
        }

        set({ panes: newPanes })

        // Close empty panes
        for (const paneId of panesToClose) {
          get().closePane(paneId)
        }
      },

      updateTabPath: (oldPath: string, newPath: string) => {
        const state = get()
        const newPanes: Record<string, Pane> = {}

        for (const [paneId, pane] of Object.entries(state.panes)) {
          const updatedTabs = pane.tabs.map((t) =>
            t.relativePath === oldPath ? { ...t, relativePath: newPath } : t
          )
          const updatedRecentlyClosedPaths = pane.recentlyClosedPaths.map((p) =>
            p === oldPath ? newPath : p
          )
          newPanes[paneId] = {
            ...pane,
            tabs: updatedTabs,
            recentlyClosedPaths: updatedRecentlyClosedPaths
          }
        }

        set({ panes: newPanes })
      },

      validatePanes: (existingPaths: Set<string>) => {
        const state = get()
        const newPanes: Record<string, Pane> = {}
        const panesToRemove: string[] = []

        for (const [paneId, pane] of Object.entries(state.panes)) {
          const validTabs = pane.tabs.filter((t) => existingPaths.has(t.relativePath))
          const validRecentlyClosedPaths = pane.recentlyClosedPaths.filter((p) =>
            existingPaths.has(p)
          )

          if (validTabs.length === 0) {
            panesToRemove.push(paneId)
          } else {
            const activeTabId =
              pane.activeTabId && validTabs.some((t) => t.id === pane.activeTabId)
                ? pane.activeTabId
                : validTabs[0].id

            newPanes[paneId] = {
              ...pane,
              tabs: validTabs,
              activeTabId,
              recentlyClosedPaths: validRecentlyClosedPaths
            }
          }
        }

        // Rebuild layout removing invalid panes
        let newLayout = state.layout
        for (const paneId of panesToRemove) {
          newLayout = removePaneFromLayout(newLayout, paneId)
        }

        let newFocusedPaneId = state.focusedPaneId
        if (newFocusedPaneId && !newPanes[newFocusedPaneId]) {
          const remainingIds = newLayout ? getLeaves(newLayout) : []
          newFocusedPaneId = remainingIds[0] ?? null
        }

        set({
          layout: newLayout,
          panes: newPanes,
          focusedPaneId: newFocusedPaneId
        })
      },

      getFocusedPane: () => {
        const state = get()
        if (!state.focusedPaneId) return null
        return state.panes[state.focusedPaneId] ?? null
      },

      getActiveTabInFocusedPane: () => {
        const pane = get().getFocusedPane()
        if (!pane || !pane.activeTabId) return null
        return pane.tabs.find((t) => t.id === pane.activeTabId) ?? null
      }
    }),
    {
      name: `onpoint.panes.v1.${WINDOW_ID}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedPanesState => ({
        layout: state.layout,
        panes: state.panes,
        focusedPaneId: state.focusedPaneId
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedPanesState>

        const panes =
          persisted.panes && typeof persisted.panes === 'object'
            ? persisted.panes
            : currentState.panes

        const focusedPaneId =
          typeof persisted.focusedPaneId === 'string' || persisted.focusedPaneId === null
            ? persisted.focusedPaneId
            : currentState.focusedPaneId

        const layout = persisted.layout !== undefined ? persisted.layout : currentState.layout

        // Validate focusedPaneId
        const validFocusedPaneId =
          focusedPaneId && panes[focusedPaneId]
            ? focusedPaneId
            : Object.keys(panes)[0] ?? null

        return {
          ...currentState,
          layout,
          panes,
          focusedPaneId: validFocusedPaneId
        }
      }
    }
  )
)

// Helper: replace a node at a given path in the mosaic tree
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
