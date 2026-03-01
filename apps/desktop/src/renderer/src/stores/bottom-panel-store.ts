import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MosaicBranch, MosaicDirection, MosaicNode } from 'react-mosaic-component'
import { createRemoveUpdate, getLeaves, updateTree } from 'react-mosaic-component'
import {
  BOTTOM_PANEL_DEFAULT_VIEW_ID,
  BOTTOM_PANEL_VIEW_DEFINITIONS_BY_ID,
  type BottomPanelViewId
} from '@/bottom-panel/view-definitions'
import { WINDOW_ID } from '@/lib/detached-window'

if (WINDOW_ID === 'main') {
  const keyedKey = 'onpoint.bottom-panel.v1.main'
  const unkeyedKey = 'onpoint.bottom-panel.v1'
  if (!localStorage.getItem(keyedKey) && localStorage.getItem(unkeyedKey)) {
    localStorage.setItem(keyedKey, localStorage.getItem(unkeyedKey)!)
    localStorage.removeItem(unkeyedKey)
  }
}

export const BOTTOM_PANEL_DEFAULT_HEIGHT = 220
export const BOTTOM_PANEL_MIN_HEIGHT = 140

export function getBottomPanelMaxHeight(): number {
  if (typeof window === 'undefined') {
    return Number.MAX_SAFE_INTEGER
  }

  return Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.floor(window.innerHeight))
}

export type BottomPanelTab = {
  id: string
  viewId: BottomPanelViewId
}

export type OpenBottomPanelViewOptions = {
  allowDuplicate?: boolean
}

export type BottomPanelPane = {
  id: string
  tabs: BottomPanelTab[]
  activeTabId: string | null
}

type PersistedBottomPanelState = {
  isOpen: boolean
  height: number
  layout: MosaicNode<string> | null
  panes: Record<string, BottomPanelPane>
  focusedPaneId: string | null
}

export type BottomPanelStoreState = {
  isOpen: boolean
  height: number
  layout: MosaicNode<string> | null
  panes: Record<string, BottomPanelPane>
  focusedPaneId: string | null
  isFocused: boolean
  focusRequestId: number
  isMaximized: boolean
  restoreHeight: number

  setOpen: (open: boolean) => void
  hidePanel: () => void
  togglePanel: () => void
  showAndFocus: () => void
  setHeight: (height: number) => void
  toggleMaximize: () => void

  setFocused: (focused: boolean) => void
  setFocusedPane: (paneId: string) => void
  consumeFocusRequest: (requestId: number) => void

  updateLayout: (layout: MosaicNode<string> | null) => void
  splitPane: (
    paneId: string,
    direction: MosaicDirection,
    viewId?: BottomPanelViewId
  ) => string | null

  openView: (
    viewId: BottomPanelViewId,
    paneId?: string,
    options?: OpenBottomPanelViewOptions
  ) => string
  closeTab: (paneId: string, tabId: string) => void
  setActiveTab: (paneId: string, tabId: string) => void
  reorderTab: (paneId: string, fromIndex: number, toIndex: number) => void
  moveTabToPane: (fromPaneId: string, tabId: string, toPaneId: string) => void
  splitPaneWithTab: (
    targetPaneId: string,
    direction: MosaicDirection,
    position: 'first' | 'second',
    fromPaneId: string,
    tabId: string
  ) => void
  cycleTabs: (direction: 'next' | 'prev', paneId?: string) => void

  getFocusedPane: () => BottomPanelPane | null
}

function clampBottomPanelHeight(height: number): number {
  return Math.min(Math.max(height, BOTTOM_PANEL_MIN_HEIGHT), getBottomPanelMaxHeight())
}

function normalizeBottomPanelHeight(height: number): number {
  if (!Number.isFinite(height)) return BOTTOM_PANEL_DEFAULT_HEIGHT
  return clampBottomPanelHeight(height)
}

function createPaneId(): string {
  return `bottom-pane-${crypto.randomUUID()}`
}

function createTabId(): string {
  return `bottom-tab-${crypto.randomUUID()}`
}

function createTab(viewId: BottomPanelViewId): BottomPanelTab {
  return {
    id: createTabId(),
    viewId
  }
}

function createPane(
  initialViewId: BottomPanelViewId = BOTTOM_PANEL_DEFAULT_VIEW_ID
): BottomPanelPane {
  const tab = createTab(initialViewId)
  const paneId = createPaneId()
  return {
    id: paneId,
    tabs: [tab],
    activeTabId: tab.id
  }
}

function createInitialPersistedState(): PersistedBottomPanelState {
  const pane = createPane()
  return {
    isOpen: false,
    height: BOTTOM_PANEL_DEFAULT_HEIGHT,
    layout: pane.id,
    panes: {
      [pane.id]: pane
    },
    focusedPaneId: pane.id
  }
}

let focusRequestSequence = 1

function createFocusRequestId(): number {
  const id = focusRequestSequence
  focusRequestSequence += 1
  return id
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

function replaceAtPath(
  tree: MosaicNode<string>,
  path: MosaicBranch[],
  replacement: MosaicNode<string>
): MosaicNode<string> {
  if (path.length === 0) return replacement
  if (typeof tree === 'string') return tree

  const [head, ...rest] = path

  if (head === 'first') {
    return {
      ...tree,
      first: replaceAtPath(tree.first, rest, replacement)
    }
  }

  if (head === 'second') {
    return {
      ...tree,
      second: replaceAtPath(tree.second, rest, replacement)
    }
  }

  return tree
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

function isBottomPanelViewId(value: string): value is BottomPanelViewId {
  return value in BOTTOM_PANEL_VIEW_DEFINITIONS_BY_ID
}

function normalizePersistedState(
  persistedState: Partial<PersistedBottomPanelState> | undefined,
  fallbackState: PersistedBottomPanelState
): PersistedBottomPanelState {
  const fallbackPaneIds = Object.keys(fallbackState.panes)
  const nextPanes: Record<string, BottomPanelPane> = {}

  if (persistedState?.panes && typeof persistedState.panes === 'object') {
    for (const [paneId, pane] of Object.entries(persistedState.panes)) {
      if (!pane || typeof pane !== 'object' || !Array.isArray(pane.tabs)) continue

      const tabs = pane.tabs
        .filter((tab): tab is BottomPanelTab => {
          return Boolean(
            tab &&
            typeof tab === 'object' &&
            typeof tab.id === 'string' &&
            typeof tab.viewId === 'string' &&
            isBottomPanelViewId(tab.viewId)
          )
        })
        .map((tab) => ({ id: tab.id, viewId: tab.viewId }))

      if (tabs.length === 0) continue

      const activeTabId =
        typeof pane.activeTabId === 'string' && tabs.some((tab) => tab.id === pane.activeTabId)
          ? pane.activeTabId
          : tabs[0].id

      nextPanes[paneId] = {
        id: paneId,
        tabs,
        activeTabId
      }
    }
  }

  if (Object.keys(nextPanes).length === 0) {
    return fallbackState
  }

  const paneIds = new Set(Object.keys(nextPanes))

  const persistedLayout = persistedState?.layout
  let layout: MosaicNode<string> | null = null

  if (persistedLayout !== undefined) {
    try {
      if (persistedLayout === null) {
        layout = null
      } else if (typeof persistedLayout === 'string') {
        layout = paneIds.has(persistedLayout) ? persistedLayout : null
      } else {
        const leaves = getLeaves(persistedLayout)
        layout =
          leaves.length > 0 && leaves.every((paneId) => paneIds.has(paneId))
            ? persistedLayout
            : null
      }
    } catch {
      layout = null
    }
  }

  if (layout === null) {
    const firstPaneId = Object.keys(nextPanes)[0] ?? fallbackPaneIds[0]
    layout = firstPaneId ?? null
  }

  const focusedPaneIdCandidate =
    typeof persistedState?.focusedPaneId === 'string' ? persistedState.focusedPaneId : null

  const focusedPaneId =
    focusedPaneIdCandidate && nextPanes[focusedPaneIdCandidate]
      ? focusedPaneIdCandidate
      : (Object.keys(nextPanes)[0] ?? null)

  return {
    isOpen:
      typeof persistedState?.isOpen === 'boolean' ? persistedState.isOpen : fallbackState.isOpen,
    height: normalizeBottomPanelHeight(
      typeof persistedState?.height === 'number' ? persistedState.height : fallbackState.height
    ),
    layout,
    panes: nextPanes,
    focusedPaneId
  }
}

export const useBottomPanelStore = create<BottomPanelStoreState>()(
  persist(
    (set, get) => {
      const initial = createInitialPersistedState()

      return {
        isOpen: initial.isOpen,
        height: initial.height,
        layout: initial.layout,
        panes: initial.panes,
        focusedPaneId: initial.focusedPaneId,
        isFocused: false,
        focusRequestId: 0,
        isMaximized: false,
        restoreHeight: BOTTOM_PANEL_DEFAULT_HEIGHT,

        setOpen: (open) => {
          set((state) => ({
            isOpen: open,
            isFocused: open ? state.isFocused : false,
            isMaximized: open ? state.isMaximized : false
          }))
        },

        hidePanel: () => {
          set((state) => ({
            isOpen: false,
            isFocused: false,
            isMaximized: false,
            height: state.isMaximized
              ? normalizeBottomPanelHeight(state.restoreHeight)
              : state.height
          }))
        },

        togglePanel: () => {
          set((state) => {
            const isOpen = !state.isOpen
            return {
              isOpen,
              isFocused: isOpen ? state.isFocused : false,
              isMaximized: isOpen ? state.isMaximized : false,
              height:
                !isOpen && state.isMaximized
                  ? normalizeBottomPanelHeight(state.restoreHeight)
                  : state.height
            }
          })
        },

        showAndFocus: () => {
          set({
            isOpen: true,
            isFocused: true,
            focusRequestId: createFocusRequestId()
          })
        },

        setHeight: (height) => {
          set({
            height: normalizeBottomPanelHeight(height),
            isMaximized: false
          })
        },

        toggleMaximize: () => {
          set((state) => {
            if (state.isMaximized) {
              return {
                isMaximized: false,
                height: normalizeBottomPanelHeight(state.restoreHeight)
              }
            }

            return {
              isOpen: true,
              isMaximized: true,
              restoreHeight: state.height,
              height: getBottomPanelMaxHeight()
            }
          })
        },

        setFocused: (focused) => {
          set((state) => ({
            isFocused: state.isOpen ? focused : false
          }))
        },

        setFocusedPane: (paneId) => {
          const state = get()
          if (!state.panes[paneId]) return
          set({ focusedPaneId: paneId })
        },

        consumeFocusRequest: (requestId) => {
          const state = get()
          if (!requestId || state.focusRequestId !== requestId) return
          set({ focusRequestId: 0 })
        },

        updateLayout: (layout) => {
          set({ layout })
        },

        splitPane: (paneId, direction, viewId = BOTTOM_PANEL_DEFAULT_VIEW_ID) => {
          const state = get()
          const pane = state.panes[paneId]
          if (!pane) return null

          const path = findPaneIdInLayout(state.layout, paneId)
          if (path === null) return null

          const newPane = createPane(viewId)
          const splitNode: MosaicNode<string> = {
            direction,
            first: paneId,
            second: newPane.id,
            splitPercentage: 50
          }

          let newLayout: MosaicNode<string>
          if (path.length === 0) {
            newLayout = splitNode
          } else {
            newLayout = replaceAtPath(state.layout!, path, splitNode)
          }

          set({
            layout: newLayout,
            panes: {
              ...state.panes,
              [newPane.id]: newPane
            },
            focusedPaneId: newPane.id,
            isOpen: true
          })

          return newPane.id
        },

        openView: (viewId, paneId, options) => {
          const state = get()
          const targetPaneId = paneId ?? state.focusedPaneId
          const allowDuplicate = options?.allowDuplicate ?? false

          if (!targetPaneId || !state.panes[targetPaneId]) {
            const pane = createPane(viewId)
            const nextLayout: MosaicNode<string> =
              state.layout === null
                ? pane.id
                : { direction: 'row', first: state.layout, second: pane.id, splitPercentage: 50 }
            set({
              panes: {
                ...state.panes,
                [pane.id]: pane
              },
              layout: nextLayout,
              focusedPaneId: pane.id,
              isOpen: true
            })
            return pane.id
          }

          const pane = state.panes[targetPaneId]
          const existingTab = allowDuplicate
            ? undefined
            : pane.tabs.find((tab) => tab.viewId === viewId)

          if (existingTab) {
            set({
              panes: {
                ...state.panes,
                [targetPaneId]: {
                  ...pane,
                  activeTabId: existingTab.id
                }
              },
              focusedPaneId: targetPaneId,
              isOpen: true
            })
            return targetPaneId
          }

          const newTab = createTab(viewId)

          set({
            panes: {
              ...state.panes,
              [targetPaneId]: {
                ...pane,
                tabs: [...pane.tabs, newTab],
                activeTabId: newTab.id
              }
            },
            focusedPaneId: targetPaneId,
            isOpen: true
          })

          return targetPaneId
        },

        closeTab: (paneId, tabId) => {
          const state = get()
          const pane = state.panes[paneId]
          if (!pane) return

          const tabIndex = pane.tabs.findIndex((tab) => tab.id === tabId)
          if (tabIndex === -1) return

          if (pane.tabs.length === 1) {
            const paneCount = Object.keys(state.panes).length

            // Closing the final tab closes the panel, but keeps an initial
            // default pane ready for the next open.
            if (paneCount <= 1) {
              const nextPane = createPane()
              set({
                panes: { [nextPane.id]: nextPane },
                layout: nextPane.id,
                focusedPaneId: nextPane.id,
                isOpen: false,
                isFocused: false,
                isMaximized: false,
                height: state.isMaximized
                  ? normalizeBottomPanelHeight(state.restoreHeight)
                  : state.height
              })
              return
            }

            const nextPanes = { ...state.panes }
            delete nextPanes[paneId]
            const nextLayout = removePaneFromLayout(state.layout, paneId)
            const remainingPaneIds = nextLayout ? getLeaves(nextLayout) : []

            set({
              panes: nextPanes,
              layout: nextLayout,
              focusedPaneId: remainingPaneIds[0] ?? Object.keys(nextPanes)[0] ?? null
            })
            return
          }

          const tabs = pane.tabs.filter((tab) => tab.id !== tabId)
          const activeTabId =
            pane.activeTabId === tabId
              ? (tabs[Math.min(tabIndex, tabs.length - 1)]?.id ?? tabs[0]?.id ?? null)
              : pane.activeTabId

          set({
            panes: {
              ...state.panes,
              [paneId]: {
                ...pane,
                tabs,
                activeTabId
              }
            }
          })
        },

        setActiveTab: (paneId, tabId) => {
          const state = get()
          const pane = state.panes[paneId]
          if (!pane || !pane.tabs.some((tab) => tab.id === tabId)) return

          set({
            panes: {
              ...state.panes,
              [paneId]: {
                ...pane,
                activeTabId: tabId
              }
            },
            focusedPaneId: paneId
          })
        },

        reorderTab: (paneId, fromIndex, toIndex) => {
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

          const tabs = [...pane.tabs]
          const [moved] = tabs.splice(fromIndex, 1)
          tabs.splice(toIndex, 0, moved)

          set({
            panes: {
              ...state.panes,
              [paneId]: {
                ...pane,
                tabs
              }
            }
          })
        },

        moveTabToPane: (fromPaneId, tabId, toPaneId) => {
          const state = get()
          if (fromPaneId === toPaneId) return

          const fromPane = state.panes[fromPaneId]
          const toPane = state.panes[toPaneId]
          if (!fromPane || !toPane) return

          const tab = fromPane.tabs.find((candidate) => candidate.id === tabId)
          if (!tab) return

          const fromTabs = fromPane.tabs.filter((candidate) => candidate.id !== tabId)
          const fromIndex = fromPane.tabs.findIndex((candidate) => candidate.id === tabId)

          const panes = {
            ...state.panes,
            [toPaneId]: {
              ...toPane,
              tabs: [...toPane.tabs, tab],
              activeTabId: tab.id
            }
          }

          let layout = state.layout

          if (fromTabs.length === 0) {
            delete panes[fromPaneId]
            layout = removePaneFromLayout(layout, fromPaneId)
          } else {
            panes[fromPaneId] = {
              ...fromPane,
              tabs: fromTabs,
              activeTabId:
                fromPane.activeTabId === tabId
                  ? (fromTabs[Math.min(fromIndex, fromTabs.length - 1)]?.id ??
                    fromTabs[0]?.id ??
                    null)
                  : fromPane.activeTabId
            }
          }

          set({
            panes,
            layout,
            focusedPaneId: toPaneId
          })
        },

        splitPaneWithTab: (targetPaneId, direction, position, fromPaneId, tabId) => {
          const state = get()
          const fromPane = state.panes[fromPaneId]
          const targetPane = state.panes[targetPaneId]
          if (!fromPane || !targetPane) return

          const tab = fromPane.tabs.find((candidate) => candidate.id === tabId)
          if (!tab) return

          const targetPath = findPaneIdInLayout(state.layout, targetPaneId)
          if (targetPath === null) return

          const shouldDuplicateTab = fromPaneId === targetPaneId && fromPane.tabs.length <= 1
          const movedTab = shouldDuplicateTab ? createTab(tab.viewId) : tab

          const newPaneId = createPaneId()
          const newPane: BottomPanelPane = {
            id: newPaneId,
            tabs: [movedTab],
            activeTabId: movedTab.id
          }

          const splitNode: MosaicNode<string> = {
            direction,
            first: position === 'first' ? newPaneId : targetPaneId,
            second: position === 'second' ? newPaneId : targetPaneId,
            splitPercentage: 50
          }

          let layout: MosaicNode<string>
          if (targetPath.length === 0) {
            layout = splitNode
          } else {
            layout = replaceAtPath(state.layout!, targetPath, splitNode)
          }

          const panes = {
            ...state.panes,
            [newPaneId]: newPane
          }

          if (!shouldDuplicateTab) {
            const fromTabs = fromPane.tabs.filter((candidate) => candidate.id !== tabId)
            const fromIndex = fromPane.tabs.findIndex((candidate) => candidate.id === tabId)

            if (fromTabs.length === 0) {
              delete panes[fromPaneId]
              layout = removePaneFromLayout(layout, fromPaneId) ?? layout
            } else {
              panes[fromPaneId] = {
                ...fromPane,
                tabs: fromTabs,
                activeTabId:
                  fromPane.activeTabId === tabId
                    ? (fromTabs[Math.min(fromIndex, fromTabs.length - 1)]?.id ??
                      fromTabs[0]?.id ??
                      null)
                    : fromPane.activeTabId
              }
            }
          }

          set({
            layout,
            panes,
            focusedPaneId: newPaneId
          })
        },

        cycleTabs: (direction, paneId) => {
          const state = get()
          const targetPaneId = paneId ?? state.focusedPaneId
          if (!targetPaneId) return

          const pane = state.panes[targetPaneId]
          if (!pane || pane.tabs.length <= 1) return

          const currentIndex = pane.tabs.findIndex((tab) => tab.id === pane.activeTabId)
          if (currentIndex === -1) return

          const offset = direction === 'next' ? 1 : -1
          const nextIndex = (currentIndex + offset + pane.tabs.length) % pane.tabs.length
          const nextTab = pane.tabs[nextIndex]
          if (!nextTab) return

          set({
            panes: {
              ...state.panes,
              [targetPaneId]: {
                ...pane,
                activeTabId: nextTab.id
              }
            },
            focusedPaneId: targetPaneId
          })
        },

        getFocusedPane: () => {
          const state = get()
          if (!state.focusedPaneId) return null
          return state.panes[state.focusedPaneId] ?? null
        }
      }
    },
    {
      name: `onpoint.bottom-panel.v1.${WINDOW_ID}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedBottomPanelState => ({
        isOpen: state.isOpen,
        height: state.height,
        layout: state.layout,
        panes: state.panes,
        focusedPaneId: state.focusedPaneId
      }),
      merge: (persistedState, currentState) => {
        const normalized = normalizePersistedState(
          (persistedState ?? {}) as Partial<PersistedBottomPanelState>,
          {
            isOpen: currentState.isOpen,
            height: currentState.height,
            layout: currentState.layout,
            panes: currentState.panes,
            focusedPaneId: currentState.focusedPaneId
          }
        )

        return {
          ...currentState,
          ...normalized,
          isFocused: false,
          focusRequestId: 0
        }
      }
    }
  )
)

export function removeBottomPanelPane(
  layout: MosaicNode<string> | null,
  paneId: string
): MosaicNode<string> | null {
  return removePaneFromLayout(layout, paneId)
}
