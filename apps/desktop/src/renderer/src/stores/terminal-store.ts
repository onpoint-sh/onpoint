import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MosaicBranch, MosaicDirection, MosaicNode } from 'react-mosaic-component'
import { createRemoveUpdate, getLeaves, updateTree } from 'react-mosaic-component'
import {
  DEFAULT_TERMINAL_SETTINGS,
  type TerminalCreateOptions,
  type TerminalSessionId,
  type TerminalSessionMetaPatch,
  type TerminalSessionSummary,
  type TerminalSettings
} from '@onpoint/shared/terminal'
import {
  createTerminalEditorPath,
  getTerminalEditorId,
  isTerminalEditorPath
} from '@/lib/terminal-editor-tab'
import { terminalClient } from '@/lib/terminal-client'
import { useBottomPanelStore } from '@/stores/bottom-panel-store'

const MAX_BUFFER_BYTES = 2 * 1024 * 1024
const RESIZE_THROTTLE_MS = 60

export type TerminalPanelGroupId = string
export type TerminalGroupLayoutNode = MosaicNode<TerminalSessionId>

export type TerminalPanelGroupState = {
  id: TerminalPanelGroupId
  layout: TerminalGroupLayoutNode | null
  activeSessionId: TerminalSessionId | null
  sessionIds: TerminalSessionId[]
}

export type TerminalGroupSessionTreeItem = {
  sessionId: TerminalSessionId
  depth: number
  branch: 'root' | 'first' | 'second'
}

type PersistedTerminalState = {
  settings: TerminalSettings
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>
  sessionByEditorPath: Record<string, TerminalSessionId>
  sessionByBottomPanelTabId?: Record<string, TerminalSessionId>
}

export type EnsureEditorTerminalSessionResult = {
  sessionId: TerminalSessionId
  path: string
}

export type TerminalStoreState = {
  settings: TerminalSettings
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>
  groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId>
  sessionByEditorPath: Record<string, TerminalSessionId>

  sessionsById: Record<TerminalSessionId, TerminalSessionSummary>
  bufferBySessionId: Record<TerminalSessionId, string>
  bellVersionBySessionId: Record<TerminalSessionId, number>
  isInitialized: boolean
  isBootstrapping: boolean
  isTerminalFocus: boolean
  isTerminalTextFocus: boolean
  focusedSessionId: TerminalSessionId | null

  initialize: () => Promise<void>
  createSession: (options?: TerminalCreateOptions) => Promise<TerminalSessionSummary>
  ensureGroupForBottomPanelTab: (
    tabId: string,
    options?: Omit<TerminalCreateOptions, 'surface'>
  ) => Promise<TerminalPanelGroupId>
  createSessionInGroup: (
    tabId: string,
    options?: Omit<TerminalCreateOptions, 'surface'>
  ) => Promise<TerminalSessionId>
  splitSessionInGroup: (
    tabId: string,
    sourceSessionId: TerminalSessionId,
    direction: MosaicDirection
  ) => Promise<TerminalSessionId>
  setActiveSessionInGroup: (tabId: string, sessionId: TerminalSessionId) => void
  killSessionInGroup: (tabId: string, sessionId: TerminalSessionId) => Promise<void>
  updateGroupLayout: (tabId: string, layout: TerminalGroupLayoutNode | null) => void

  ensureSessionForBottomPanelTab: (
    tabId: string,
    options?: Omit<TerminalCreateOptions, 'surface'>
  ) => Promise<TerminalSessionId>
  ensureSessionForEditorPath: (
    path: string,
    options?: Omit<TerminalCreateOptions, 'surface'>
  ) => Promise<EnsureEditorTerminalSessionResult>

  attachEditorPathToSession: (path: string, sessionId: TerminalSessionId) => void
  mergeBottomPanelTabSessions: (sourceTabId: string, targetTabId: string) => void
  detachBottomPanelTab: (tabId: string) => Promise<void>
  detachEditorPath: (path: string) => Promise<void>

  getGroupForBottomPanelTab: (tabId: string) => TerminalPanelGroupState | null
  getSessionIdsForBottomPanelTab: (tabId: string) => TerminalSessionId[]
  getSessionTreeForBottomPanelTab: (tabId: string) => TerminalGroupSessionTreeItem[]
  getBottomPanelTabIdForSession: (sessionId: TerminalSessionId) => string | null

  getSessionForBottomPanelTab: (tabId: string) => TerminalSessionSummary | null
  getSessionForEditorPath: (path: string) => TerminalSessionSummary | null
  getSession: (sessionId: TerminalSessionId) => TerminalSessionSummary | null
  getBuffer: (sessionId: TerminalSessionId) => string
  getBellVersion: (sessionId: TerminalSessionId) => number

  restartSession: (sessionId: TerminalSessionId) => Promise<TerminalSessionSummary>
  write: (sessionId: TerminalSessionId, data: string) => Promise<void>
  queueResize: (sessionId: TerminalSessionId, cols: number, rows: number) => void
  updateSessionMeta: (
    sessionId: TerminalSessionId,
    patch: TerminalSessionMetaPatch
  ) => Promise<void>
  clearBuffer: (sessionId: TerminalSessionId) => Promise<void>
  killSession: (sessionId: TerminalSessionId) => Promise<void>
  updateSettings: (patch: Partial<TerminalSettings>) => Promise<void>
  setFocusedSession: (sessionId: TerminalSessionId | null) => void
  setTerminalTextFocus: (value: boolean) => void
  syncBottomPanelTabIds: (tabIds: string[]) => Promise<void>
  syncEditorPaths: (paths: string[]) => Promise<void>
}

type SessionAssociationCleanupResult = {
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>
  groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId>
  sessionByEditorPath: Record<string, TerminalSessionId>
  focusedSessionId: TerminalSessionId | null
  isTerminalFocus: boolean
  isTerminalTextFocus: boolean
}

type SessionAssociationState = Pick<
  TerminalStoreState,
  | 'groupByBottomPanelTabId'
  | 'groupsById'
  | 'groupIdBySessionId'
  | 'sessionByEditorPath'
  | 'focusedSessionId'
  | 'isTerminalFocus'
  | 'isTerminalTextFocus'
>

let subscriptionsBound = false
let pendingBootstrap: Promise<void> | null = null

const resizeTimerBySessionId = new Map<string, number>()
const pendingResizeBySessionId = new Map<string, { cols: number; rows: number }>()
const pendingRestartBySessionId = new Map<TerminalSessionId, Promise<TerminalSessionSummary>>()
const pendingEnsureGroupByTabId = new Map<string, Promise<TerminalPanelGroupId>>()

function trimBuffer(buffer: string): string {
  if (buffer.length <= MAX_BUFFER_BYTES) return buffer
  return buffer.slice(buffer.length - MAX_BUFFER_BYTES)
}

function clearPendingResize(sessionId: TerminalSessionId): void {
  const timer = resizeTimerBySessionId.get(sessionId)
  if (timer) {
    window.clearTimeout(timer)
    resizeTimerBySessionId.delete(sessionId)
  }
  pendingResizeBySessionId.delete(sessionId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function createGroupId(): TerminalPanelGroupId {
  return `terminal-group-${crypto.randomUUID()}`
}

function normalizeStringMapping(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}

  const next: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) continue
    next[key] = rawValue
  }

  return next
}

function normalizeLayoutNode(value: unknown): TerminalGroupLayoutNode | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (!isRecord(value)) return null

  const direction = value.direction
  if (direction !== 'row' && direction !== 'column') {
    return null
  }

  const first = normalizeLayoutNode(value.first)
  const second = normalizeLayoutNode(value.second)

  if (!first || !second) {
    return null
  }

  const splitPercentage =
    typeof value.splitPercentage === 'number' && Number.isFinite(value.splitPercentage)
      ? Math.min(95, Math.max(5, value.splitPercentage))
      : 50

  return {
    direction,
    first,
    second,
    splitPercentage
  }
}

function normalizePersistedGroups(
  value: unknown
): Record<TerminalPanelGroupId, TerminalPanelGroupState> {
  if (!isRecord(value)) return {}

  const groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState> = {}

  for (const [groupId, rawGroup] of Object.entries(value)) {
    if (!isRecord(rawGroup)) continue

    const layout = normalizeLayoutNode(rawGroup.layout)
    const activeSessionId =
      typeof rawGroup.activeSessionId === 'string' && rawGroup.activeSessionId.trim().length > 0
        ? rawGroup.activeSessionId
        : null

    const rawSessionIds = Array.isArray(rawGroup.sessionIds) ? rawGroup.sessionIds : []
    const normalizedSessionIds = rawSessionIds.filter(
      (candidate): candidate is TerminalSessionId =>
        typeof candidate === 'string' && candidate.trim().length > 0
    )
    const fallbackSessionIds = getLayoutSessionIds(layout)
    const sessionIds = normalizedSessionIds.length > 0 ? normalizedSessionIds : fallbackSessionIds

    groupsById[groupId] = {
      id: groupId,
      layout,
      activeSessionId,
      sessionIds
    }
  }

  return groupsById
}

function getLayoutSessionIds(layout: TerminalGroupLayoutNode | null): TerminalSessionId[] {
  if (!layout) return []
  if (typeof layout === 'string') return [layout]

  try {
    return getLeaves(layout)
  } catch {
    return []
  }
}

function findLayoutPath(
  layout: TerminalGroupLayoutNode | null,
  targetSessionId: TerminalSessionId
): MosaicBranch[] | null {
  if (layout === null) return null

  if (typeof layout === 'string') {
    return layout === targetSessionId ? [] : null
  }

  const firstPath = findLayoutPath(layout.first, targetSessionId)
  if (firstPath !== null) return ['first' as MosaicBranch, ...firstPath]

  const secondPath = findLayoutPath(layout.second, targetSessionId)
  if (secondPath !== null) return ['second' as MosaicBranch, ...secondPath]

  return null
}

function replaceAtPath(
  layout: TerminalGroupLayoutNode,
  path: MosaicBranch[],
  replacement: TerminalGroupLayoutNode
): TerminalGroupLayoutNode {
  if (path.length === 0) return replacement
  if (typeof layout === 'string') return layout

  const [head, ...rest] = path

  if (head === 'first') {
    return {
      ...layout,
      first: replaceAtPath(layout.first, rest, replacement)
    }
  }

  if (head === 'second') {
    return {
      ...layout,
      second: replaceAtPath(layout.second, rest, replacement)
    }
  }

  return layout
}

function removeSessionFromLayout(
  layout: TerminalGroupLayoutNode | null,
  sessionId: TerminalSessionId
): TerminalGroupLayoutNode | null {
  if (layout === null) return null

  if (typeof layout === 'string') {
    return layout === sessionId ? null : layout
  }

  const path = findLayoutPath(layout, sessionId)
  if (path === null) return layout

  const update = createRemoveUpdate(layout, path)
  return updateTree(layout, [update])
}

function splitLayoutAtSession(
  layout: TerminalGroupLayoutNode | null,
  sourceSessionId: TerminalSessionId,
  direction: MosaicDirection,
  nextSessionId: TerminalSessionId
): TerminalGroupLayoutNode {
  if (!layout) {
    return nextSessionId
  }

  const splitNode: TerminalGroupLayoutNode = {
    direction,
    first: sourceSessionId,
    second: nextSessionId,
    splitPercentage: 50
  }

  const path = findLayoutPath(layout, sourceSessionId)

  if (path === null) {
    if (typeof layout === 'string') {
      return {
        direction,
        first: layout,
        second: nextSessionId,
        splitPercentage: 50
      }
    }

    const fallback = getLayoutSessionIds(layout)[0]
    if (!fallback) {
      return nextSessionId
    }

    return splitLayoutAtSession(layout, fallback, direction, nextSessionId)
  }

  if (path.length === 0) {
    return splitNode
  }

  return replaceAtPath(layout, path, splitNode)
}

function replaceSessionInLayout(
  layout: TerminalGroupLayoutNode | null,
  previousSessionId: TerminalSessionId,
  nextSessionId: TerminalSessionId
): TerminalGroupLayoutNode | null {
  if (!layout) return layout

  if (typeof layout === 'string') {
    return layout === previousSessionId ? nextSessionId : layout
  }

  return {
    ...layout,
    first: replaceSessionInLayout(layout.first, previousSessionId, nextSessionId) ?? layout.first,
    second: replaceSessionInLayout(layout.second, previousSessionId, nextSessionId) ?? layout.second
  }
}

function flattenGroupSessionTree(
  layout: TerminalGroupLayoutNode | null,
  allSessionIds: TerminalSessionId[] = []
): TerminalGroupSessionTreeItem[] {
  if (!layout) {
    return allSessionIds.map((sessionId) => ({ sessionId, depth: 0, branch: 'root' }))
  }

  if (typeof layout === 'string') {
    const trailingItems = allSessionIds
      .filter((sessionId) => sessionId !== layout)
      .map(
        (sessionId): TerminalGroupSessionTreeItem => ({
          sessionId,
          depth: 0,
          branch: 'root'
        })
      )
    return [{ sessionId: layout, depth: 0, branch: 'root' }, ...trailingItems]
  }

  const items: TerminalGroupSessionTreeItem[] = []

  const walk = (
    node: TerminalGroupLayoutNode,
    depth: number,
    branch: TerminalGroupSessionTreeItem['branch']
  ): void => {
    if (typeof node === 'string') {
      items.push({ sessionId: node, depth, branch })
      return
    }

    walk(node.first, depth + 1, 'first')
    walk(node.second, depth + 1, 'second')
  }

  walk(layout.first, 0, 'first')
  walk(layout.second, 0, 'second')

  const seenSessionIds = new Set(items.map((item) => item.sessionId))
  for (const sessionId of allSessionIds) {
    if (seenSessionIds.has(sessionId)) continue
    items.push({ sessionId, depth: 0, branch: 'root' })
  }

  return items
}

function buildGroupIdBySessionId(
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>,
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
): Record<TerminalSessionId, TerminalPanelGroupId> {
  const next: Record<TerminalSessionId, TerminalPanelGroupId> = {}
  const referencedGroupIds = new Set(Object.values(groupByBottomPanelTabId))

  for (const groupId of referencedGroupIds) {
    const group = groupsById[groupId]
    if (!group) continue

    for (const sessionId of group.sessionIds) {
      if (!next[sessionId]) {
        next[sessionId] = groupId
      }
    }
  }

  return next
}

function migrateLegacyBottomPanelMap(value: unknown): {
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>
  groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId>
} {
  const legacyMap = normalizeStringMapping(value)
  const groupByBottomPanelTabId: Record<string, TerminalPanelGroupId> = {}
  const groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState> = {}
  const groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId> = {}

  for (const [tabId, sessionId] of Object.entries(legacyMap)) {
    const existingGroupId = groupIdBySessionId[sessionId]

    if (existingGroupId) {
      groupByBottomPanelTabId[tabId] = existingGroupId
      continue
    }

    const groupId = `terminal-group-migrated-${tabId}`

    groupByBottomPanelTabId[tabId] = groupId
    groupIdBySessionId[sessionId] = groupId
    groupsById[groupId] = {
      id: groupId,
      layout: sessionId,
      activeSessionId: sessionId,
      sessionIds: [sessionId]
    }
  }

  return {
    groupByBottomPanelTabId,
    groupsById,
    groupIdBySessionId
  }
}

function pruneOrphanGroups(
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>,
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>
): {
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
  groupsById: Record<TerminalPanelGroupId, TerminalPanelGroupState>
} {
  const referencedGroupIds = new Set(Object.values(groupByBottomPanelTabId))

  const nextGroups: Record<TerminalPanelGroupId, TerminalPanelGroupState> = {}
  for (const [groupId, group] of Object.entries(groupsById)) {
    if (!referencedGroupIds.has(groupId)) continue
    nextGroups[groupId] = group
  }

  const nextGroupByBottomTab: Record<string, TerminalPanelGroupId> = {}
  for (const [tabId, groupId] of Object.entries(groupByBottomPanelTabId)) {
    if (!nextGroups[groupId]) continue
    nextGroupByBottomTab[tabId] = groupId
  }

  return {
    groupByBottomPanelTabId: nextGroupByBottomTab,
    groupsById: nextGroups
  }
}

function removeSessionAssociations(
  state: SessionAssociationState,
  sessionId: TerminalSessionId
): SessionAssociationCleanupResult {
  const nextEditorMap = Object.fromEntries(
    Object.entries(state.sessionByEditorPath).filter(
      ([, mappedSessionId]) => mappedSessionId !== sessionId
    )
  )

  const nextGroupByBottomTab = { ...state.groupByBottomPanelTabId }
  const nextGroups = { ...state.groupsById }
  const nextGroupIdBySession = { ...state.groupIdBySessionId }
  delete nextGroupIdBySession[sessionId]

  for (const [groupId, group] of Object.entries(nextGroups)) {
    if (!group.sessionIds.includes(sessionId)) continue

    const nextLayout = removeSessionFromLayout(group.layout, sessionId)
    const remainingSessionIds = group.sessionIds.filter(
      (candidateSessionId) => candidateSessionId !== sessionId
    )

    if (remainingSessionIds.length === 0) {
      delete nextGroups[groupId]

      for (const [tabId, mappedGroupId] of Object.entries(nextGroupByBottomTab)) {
        if (mappedGroupId === groupId) {
          delete nextGroupByBottomTab[tabId]
        }
      }

      for (const [mappedSessionId, mappedGroupId] of Object.entries(nextGroupIdBySession)) {
        if (mappedGroupId === groupId) {
          delete nextGroupIdBySession[mappedSessionId]
        }
      }

      continue
    }

    const activeSessionId =
      group.activeSessionId && remainingSessionIds.includes(group.activeSessionId)
        ? group.activeSessionId
        : remainingSessionIds[0]

    const nextResolvedLayout =
      nextLayout && getLayoutSessionIds(nextLayout).length > 0 ? nextLayout : activeSessionId

    nextGroups[groupId] = {
      ...group,
      layout: nextResolvedLayout,
      sessionIds: remainingSessionIds,
      activeSessionId
    }

    const remainingSet = new Set(remainingSessionIds)
    for (const [mappedSessionId, mappedGroupId] of Object.entries(nextGroupIdBySession)) {
      if (mappedGroupId === groupId && !remainingSet.has(mappedSessionId)) {
        delete nextGroupIdBySession[mappedSessionId]
      }
    }

    for (const remainingSessionId of remainingSessionIds) {
      nextGroupIdBySession[remainingSessionId] = groupId
    }
  }

  const focusedSessionId = state.focusedSessionId === sessionId ? null : state.focusedSessionId
  const isTerminalFocus = focusedSessionId ? state.isTerminalFocus : false
  const isTerminalTextFocus =
    state.focusedSessionId === sessionId ? false : state.isTerminalTextFocus

  return {
    groupByBottomPanelTabId: nextGroupByBottomTab,
    groupsById: nextGroups,
    groupIdBySessionId: nextGroupIdBySession,
    sessionByEditorPath: nextEditorMap,
    focusedSessionId,
    isTerminalFocus,
    isTerminalTextFocus
  }
}

function isSessionReferenced(
  sessionId: TerminalSessionId,
  groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId>,
  editorMap: Record<string, TerminalSessionId>
): boolean {
  if (groupIdBySessionId[sessionId]) {
    return true
  }

  for (const mappedSessionId of Object.values(editorMap)) {
    if (mappedSessionId === sessionId) {
      return true
    }
  }

  return false
}

function replaceMappedSessionId(
  mapping: Record<string, TerminalSessionId>,
  previousSessionId: TerminalSessionId,
  nextSessionId: TerminalSessionId
): Record<string, TerminalSessionId> {
  const next: Record<string, TerminalSessionId> = {}

  for (const [key, mappedSessionId] of Object.entries(mapping)) {
    next[key] = mappedSessionId === previousSessionId ? nextSessionId : mappedSessionId
  }

  return next
}

function resolveSessionSurface(
  sessionId: TerminalSessionId,
  groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId>,
  editorMap: Record<string, TerminalSessionId>
): 'bottom-panel' | 'editor' {
  if (groupIdBySessionId[sessionId]) {
    return 'bottom-panel'
  }

  for (const mappedSessionId of Object.values(editorMap)) {
    if (mappedSessionId === sessionId) {
      return 'editor'
    }
  }

  return 'bottom-panel'
}

function isRecoverableWriteError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error ? String(error.message) : ''
  const normalized = message.toLowerCase()
  if (!normalized) return false

  return (
    normalized.includes('not found') ||
    normalized.includes('access denied') ||
    normalized.includes('exited')
  )
}

function findBottomPanelTabIdForSession(
  sessionId: TerminalSessionId,
  groupIdBySessionId: Record<TerminalSessionId, TerminalPanelGroupId>,
  groupByBottomPanelTabId: Record<string, TerminalPanelGroupId>
): string | null {
  const groupId = groupIdBySessionId[sessionId]
  if (!groupId) return null

  for (const [tabId, mappedGroupId] of Object.entries(groupByBottomPanelTabId)) {
    if (mappedGroupId === groupId) return tabId
  }

  return null
}

function getLiveSessionIdsForGroup(
  group: TerminalPanelGroupState,
  sessionsById: Record<TerminalSessionId, TerminalSessionSummary>
): TerminalSessionId[] {
  return group.sessionIds.filter((sessionId) => Boolean(sessionsById[sessionId]))
}

function resolveGroupActiveSession(
  group: TerminalPanelGroupState,
  sessionsById: Record<TerminalSessionId, TerminalSessionSummary>
): TerminalSessionId | null {
  const liveSessionIds = getLiveSessionIdsForGroup(group, sessionsById)
  if (liveSessionIds.length === 0) return null

  if (group.activeSessionId && liveSessionIds.includes(group.activeSessionId)) {
    return group.activeSessionId
  }

  return liveSessionIds[0]
}

export const useTerminalStore = create<TerminalStoreState>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_TERMINAL_SETTINGS },
      groupByBottomPanelTabId: {},
      groupsById: {},
      groupIdBySessionId: {},
      sessionByEditorPath: {},
      sessionsById: {},
      bufferBySessionId: {},
      bellVersionBySessionId: {},
      isInitialized: false,
      isBootstrapping: false,
      isTerminalFocus: false,
      isTerminalTextFocus: false,
      focusedSessionId: null,

      initialize: async () => {
        if (get().isInitialized) return
        if (pendingBootstrap) {
          await pendingBootstrap
          return
        }

        pendingBootstrap = (async () => {
          set({ isBootstrapping: true })

          const [settings, sessions] = await Promise.all([
            terminalClient.getSettings(),
            terminalClient.listSessions()
          ])

          const sessionMap: Record<string, TerminalSessionSummary> = {}
          const bufferMap: Record<string, string> = {}

          await Promise.all(
            sessions.map(async (session) => {
              sessionMap[session.id] = session
              const buffer = await terminalClient.readBuffer(session.id).catch(() => '')
              bufferMap[session.id] = trimBuffer(buffer)
            })
          )

          set((state) => ({
            settings,
            sessionsById: { ...state.sessionsById, ...sessionMap },
            bufferBySessionId: { ...state.bufferBySessionId, ...bufferMap },
            isInitialized: true,
            isBootstrapping: false
          }))

          if (!subscriptionsBound) {
            subscriptionsBound = true

            terminalClient.onData(({ sessionId, data }) => {
              set((state) => {
                const previous = state.bufferBySessionId[sessionId] ?? ''
                return {
                  bufferBySessionId: {
                    ...state.bufferBySessionId,
                    [sessionId]: trimBuffer(previous + data)
                  }
                }
              })
            })

            terminalClient.onExit(({ sessionId, exitCode, signal }) => {
              set((state) => {
                const session = state.sessionsById[sessionId]
                if (!session) return state

                return {
                  sessionsById: {
                    ...state.sessionsById,
                    [sessionId]: {
                      ...session,
                      exited: true,
                      exitCode,
                      signal,
                      updatedAt: Date.now()
                    }
                  }
                }
              })

              const bottomPanelTabId = get().getBottomPanelTabIdForSession(sessionId)
              if (!bottomPanelTabId) return

              void (async () => {
                await get().killSession(sessionId)

                if (get().getSessionIdsForBottomPanelTab(bottomPanelTabId).length > 0) {
                  return
                }

                const bottomPanelState = useBottomPanelStore.getState()
                for (const pane of Object.values(bottomPanelState.panes)) {
                  if (!pane.tabs.some((tab) => tab.id === bottomPanelTabId)) continue
                  bottomPanelState.closeTab(pane.id, bottomPanelTabId)
                  break
                }
              })()
            })

            terminalClient.onTitle(({ sessionId, title }) => {
              set((state) => {
                const session = state.sessionsById[sessionId]
                if (!session) return state
                return {
                  sessionsById: {
                    ...state.sessionsById,
                    [sessionId]: {
                      ...session,
                      title,
                      updatedAt: Date.now()
                    }
                  }
                }
              })
            })

            terminalClient.onSessionChanged(({ sessionId, change, session }) => {
              if (change === 'removed') {
                clearPendingResize(sessionId)
                pendingRestartBySessionId.delete(sessionId)

                set((state) => {
                  const nextSessions = { ...state.sessionsById }
                  delete nextSessions[sessionId]

                  const nextBuffers = { ...state.bufferBySessionId }
                  delete nextBuffers[sessionId]

                  const nextBells = { ...state.bellVersionBySessionId }
                  delete nextBells[sessionId]

                  const cleanup = removeSessionAssociations(state, sessionId)

                  return {
                    ...cleanup,
                    sessionsById: nextSessions,
                    bufferBySessionId: nextBuffers,
                    bellVersionBySessionId: nextBells
                  }
                })

                return
              }

              if (!session) return

              set((state) => ({
                sessionsById: {
                  ...state.sessionsById,
                  [sessionId]: session
                }
              }))
            })

            terminalClient.onBell(({ sessionId }) => {
              set((state) => ({
                bellVersionBySessionId: {
                  ...state.bellVersionBySessionId,
                  [sessionId]: Date.now()
                }
              }))
            })
          }
        })()

        try {
          await pendingBootstrap
        } finally {
          pendingBootstrap = null
        }
      },

      createSession: async (options) => {
        const session = await terminalClient.createSession(options)
        set((state) => ({
          sessionsById: {
            ...state.sessionsById,
            [session.id]: session
          },
          bufferBySessionId: {
            ...state.bufferBySessionId,
            [session.id]: ''
          }
        }))
        return session
      },

      ensureGroupForBottomPanelTab: async (tabId, options) => {
        const pending = pendingEnsureGroupByTabId.get(tabId)
        if (pending) {
          return pending
        }

        const ensurePromise = (async () => {
          const state = get()
          const mappedGroupId = state.groupByBottomPanelTabId[tabId]
          const mappedGroup = mappedGroupId ? (state.groupsById[mappedGroupId] ?? null) : null

          if (mappedGroupId && mappedGroup) {
            const activeSessionId = resolveGroupActiveSession(mappedGroup, state.sessionsById)
            if (activeSessionId) {
              if (mappedGroup.activeSessionId !== activeSessionId) {
                set((current) => ({
                  groupsById: {
                    ...current.groupsById,
                    [mappedGroupId]: {
                      ...mappedGroup,
                      activeSessionId
                    }
                  }
                }))
              }
              return mappedGroupId
            }
          }

          const created = await get().createSession({
            ...options,
            surface: 'bottom-panel'
          })

          const fallbackGroupId = mappedGroupId ?? createGroupId()

          set((current) => {
            const nextGroupId = current.groupByBottomPanelTabId[tabId] ?? fallbackGroupId
            const previousGroup = current.groupsById[nextGroupId]
            const nextGroupIdBySession = { ...current.groupIdBySessionId }

            if (previousGroup) {
              for (const previousSessionId of previousGroup.sessionIds) {
                if (nextGroupIdBySession[previousSessionId] === nextGroupId) {
                  delete nextGroupIdBySession[previousSessionId]
                }
              }
            }

            nextGroupIdBySession[created.id] = nextGroupId

            return {
              groupByBottomPanelTabId: {
                ...current.groupByBottomPanelTabId,
                [tabId]: nextGroupId
              },
              groupsById: {
                ...current.groupsById,
                [nextGroupId]: {
                  id: nextGroupId,
                  layout: created.id,
                  activeSessionId: created.id,
                  sessionIds: [created.id]
                }
              },
              groupIdBySessionId: nextGroupIdBySession,
              focusedSessionId: created.id,
              isTerminalFocus: true
            }
          })

          return get().groupByBottomPanelTabId[tabId] ?? fallbackGroupId
        })()

        pendingEnsureGroupByTabId.set(tabId, ensurePromise)

        try {
          return await ensurePromise
        } finally {
          pendingEnsureGroupByTabId.delete(tabId)
        }
      },

      createSessionInGroup: async (tabId, options) => {
        const groupId = await get().ensureGroupForBottomPanelTab(tabId, options)
        const state = get()
        const group = state.groupsById[groupId]

        const sourceSessionId =
          group && resolveGroupActiveSession(group, state.sessionsById)
            ? (resolveGroupActiveSession(group, state.sessionsById) as TerminalSessionId)
            : null

        const sourceSummary = sourceSessionId ? (state.sessionsById[sourceSessionId] ?? null) : null

        const created = await get().createSession({
          surface: 'bottom-panel',
          name: options?.name,
          cwd: options?.cwd ?? sourceSummary?.cwd ?? undefined,
          shellPath: options?.shellPath ?? sourceSummary?.shellPath ?? undefined,
          shellArgs: options?.shellArgs ?? sourceSummary?.shellArgs ?? undefined,
          cols: sourceSummary?.cols,
          rows: sourceSummary?.rows
        })

        set((current) => {
          const currentGroupId = current.groupByBottomPanelTabId[tabId] ?? groupId
          const currentGroup = current.groupsById[currentGroupId]

          if (!currentGroup) {
            return {
              groupByBottomPanelTabId: {
                ...current.groupByBottomPanelTabId,
                [tabId]: currentGroupId
              },
              groupsById: {
                ...current.groupsById,
                [currentGroupId]: {
                  id: currentGroupId,
                  layout: created.id,
                  activeSessionId: created.id,
                  sessionIds: [created.id]
                }
              },
              groupIdBySessionId: {
                ...current.groupIdBySessionId,
                [created.id]: currentGroupId
              },
              focusedSessionId: created.id,
              isTerminalFocus: true
            }
          }

          const nextSessionIds = currentGroup.sessionIds.includes(created.id)
            ? currentGroup.sessionIds
            : [...currentGroup.sessionIds, created.id]

          return {
            groupsById: {
              ...current.groupsById,
              [currentGroupId]: {
                ...currentGroup,
                layout: created.id,
                sessionIds: nextSessionIds,
                activeSessionId: created.id
              }
            },
            groupIdBySessionId: {
              ...current.groupIdBySessionId,
              [created.id]: currentGroupId
            },
            focusedSessionId: created.id,
            isTerminalFocus: true
          }
        })

        return created.id
      },

      splitSessionInGroup: async (tabId, sourceSessionId, direction) => {
        const groupId = await get().ensureGroupForBottomPanelTab(tabId)
        const state = get()
        const group = state.groupsById[groupId]

        const currentLiveSessionIds = group
          ? getLiveSessionIdsForGroup(group, state.sessionsById)
          : []
        const resolvedSourceSessionId = currentLiveSessionIds.includes(sourceSessionId)
          ? sourceSessionId
          : group?.activeSessionId && currentLiveSessionIds.includes(group.activeSessionId)
            ? group.activeSessionId
            : (currentLiveSessionIds[0] ?? null)

        if (!resolvedSourceSessionId) {
          return get().createSessionInGroup(tabId)
        }

        const sourceSummary = state.sessionsById[resolvedSourceSessionId]

        const created = await get().createSession({
          surface: 'bottom-panel',
          name: sourceSummary?.name ?? undefined,
          cwd: sourceSummary?.cwd ?? undefined,
          shellPath: sourceSummary?.shellPath ?? undefined,
          shellArgs: sourceSummary?.shellArgs ?? undefined,
          cols: sourceSummary?.cols,
          rows: sourceSummary?.rows
        })

        set((current) => {
          const currentGroupId = current.groupByBottomPanelTabId[tabId] ?? groupId
          const currentGroup = current.groupsById[currentGroupId]

          if (!currentGroup) {
            return {
              groupByBottomPanelTabId: {
                ...current.groupByBottomPanelTabId,
                [tabId]: currentGroupId
              },
              groupsById: {
                ...current.groupsById,
                [currentGroupId]: {
                  id: currentGroupId,
                  layout: created.id,
                  activeSessionId: created.id,
                  sessionIds: [created.id]
                }
              },
              groupIdBySessionId: {
                ...current.groupIdBySessionId,
                [created.id]: currentGroupId
              },
              focusedSessionId: created.id,
              isTerminalFocus: true
            }
          }

          const latestLiveSessionIds = getLiveSessionIdsForGroup(currentGroup, current.sessionsById)
          const nextSourceSessionId = latestLiveSessionIds.includes(resolvedSourceSessionId)
            ? resolvedSourceSessionId
            : currentGroup.activeSessionId &&
                latestLiveSessionIds.includes(currentGroup.activeSessionId)
              ? currentGroup.activeSessionId
              : (latestLiveSessionIds[0] ?? null)

          const sourceInLayout =
            nextSourceSessionId !== null &&
            getLayoutSessionIds(currentGroup.layout).includes(nextSourceSessionId)
          const baseLayout =
            nextSourceSessionId === null
              ? currentGroup.layout
              : sourceInLayout
                ? currentGroup.layout
                : nextSourceSessionId

          const nextLayout =
            nextSourceSessionId === null
              ? created.id
              : splitLayoutAtSession(baseLayout, nextSourceSessionId, direction, created.id)
          const nextSessionIds = currentGroup.sessionIds.includes(created.id)
            ? currentGroup.sessionIds
            : [...currentGroup.sessionIds, created.id]

          return {
            groupsById: {
              ...current.groupsById,
              [currentGroupId]: {
                ...currentGroup,
                layout: nextLayout,
                sessionIds: nextSessionIds,
                activeSessionId: created.id
              }
            },
            groupIdBySessionId: {
              ...current.groupIdBySessionId,
              [created.id]: currentGroupId
            },
            focusedSessionId: created.id,
            isTerminalFocus: true
          }
        })

        return created.id
      },

      setActiveSessionInGroup: (tabId, sessionId) => {
        const state = get()
        const groupId = state.groupByBottomPanelTabId[tabId]
        if (!groupId) return

        const group = state.groupsById[groupId]
        if (!group) return

        const sessionIds = group.sessionIds
        if (!sessionIds.includes(sessionId)) return

        const isSessionVisibleInLayout = getLayoutSessionIds(group.layout).includes(sessionId)

        set((current) => ({
          groupsById: {
            ...current.groupsById,
            [groupId]: {
              ...group,
              layout: isSessionVisibleInLayout ? group.layout : sessionId,
              activeSessionId: sessionId
            }
          },
          focusedSessionId: sessionId,
          isTerminalFocus: true
        }))
      },

      killSessionInGroup: async (tabId, sessionId) => {
        const group = get().getGroupForBottomPanelTab(tabId)
        if (!group) return

        const sessionIds = group.sessionIds
        if (!sessionIds.includes(sessionId)) return

        await get().killSession(sessionId)
      },

      updateGroupLayout: (tabId, layout) => {
        const state = get()
        const groupId = state.groupByBottomPanelTabId[tabId]
        if (!groupId) return

        const group = state.groupsById[groupId]
        if (!group) return

        const nextLayoutSessionIds = getLayoutSessionIds(layout)
        const liveSessionIds = getLiveSessionIdsForGroup(group, state.sessionsById)
        const trailingLayoutSessionIds = nextLayoutSessionIds.filter(
          (sessionId) => !liveSessionIds.includes(sessionId)
        )
        const nextSessionIds = [...liveSessionIds, ...trailingLayoutSessionIds]
        const nextSessionSet = new Set(nextSessionIds)
        const nextActiveSessionId =
          group.activeSessionId && nextSessionSet.has(group.activeSessionId)
            ? group.activeSessionId
            : (nextLayoutSessionIds[0] ?? nextSessionIds[0] ?? null)
        const nextLayout =
          layout ?? (nextActiveSessionId ? (nextActiveSessionId as TerminalSessionId) : null)

        set((current) => {
          const nextGroupIdBySession = { ...current.groupIdBySessionId }

          for (const [sessionId, mappedGroupId] of Object.entries(nextGroupIdBySession)) {
            if (mappedGroupId === groupId && !nextSessionSet.has(sessionId)) {
              delete nextGroupIdBySession[sessionId]
            }
          }

          for (const sessionId of nextSessionIds) {
            nextGroupIdBySession[sessionId] = groupId
          }

          return {
            groupsById: {
              ...current.groupsById,
              [groupId]: {
                ...group,
                layout: nextLayout,
                sessionIds: nextSessionIds,
                activeSessionId: nextActiveSessionId
              }
            },
            groupIdBySessionId: nextGroupIdBySession
          }
        })
      },

      ensureSessionForBottomPanelTab: async (tabId, options) => {
        const groupId = await get().ensureGroupForBottomPanelTab(tabId, options)
        const group = get().groupsById[groupId]

        if (group) {
          const activeSessionId = resolveGroupActiveSession(group, get().sessionsById)
          if (activeSessionId) {
            return activeSessionId
          }
        }

        return get().createSessionInGroup(tabId, options)
      },

      ensureSessionForEditorPath: async (path, options) => {
        const state = get()
        const mappedSessionId = state.sessionByEditorPath[path]
        if (mappedSessionId && state.sessionsById[mappedSessionId]) {
          return { sessionId: mappedSessionId, path }
        }

        const parsedSessionId = getTerminalEditorId(path)
        if (parsedSessionId && state.sessionsById[parsedSessionId]) {
          set((current) => ({
            sessionByEditorPath: {
              ...current.sessionByEditorPath,
              [path]: parsedSessionId
            }
          }))
          return { sessionId: parsedSessionId, path }
        }

        if (parsedSessionId && !state.sessionsById[parsedSessionId]) {
          const sessions = await terminalClient.listSessions()
          const existing = sessions.find((candidate) => candidate.id === parsedSessionId)
          if (existing) {
            const buffer = await terminalClient.readBuffer(existing.id).catch(() => '')
            set((current) => ({
              sessionsById: {
                ...current.sessionsById,
                [existing.id]: existing
              },
              bufferBySessionId: {
                ...current.bufferBySessionId,
                [existing.id]: trimBuffer(buffer)
              },
              sessionByEditorPath: {
                ...current.sessionByEditorPath,
                [path]: existing.id
              }
            }))
            return { sessionId: existing.id, path }
          }
        }

        const created = await get().createSession({
          ...options,
          surface: 'editor'
        })
        const nextPath = createTerminalEditorPath(created.id)
        set((current) => ({
          sessionByEditorPath: {
            ...current.sessionByEditorPath,
            [nextPath]: created.id
          }
        }))
        return { sessionId: created.id, path: nextPath }
      },

      attachEditorPathToSession: (path, sessionId) => {
        set((state) => ({
          sessionByEditorPath: {
            ...state.sessionByEditorPath,
            [path]: sessionId
          }
        }))
      },

      mergeBottomPanelTabSessions: (sourceTabId, targetTabId) => {
        if (sourceTabId === targetTabId) return

        set((state) => {
          const sourceGroupId = state.groupByBottomPanelTabId[sourceTabId]
          if (!sourceGroupId) return state

          const sourceGroup = state.groupsById[sourceGroupId]
          if (!sourceGroup) {
            const nextGroupByBottomPanelTabId = { ...state.groupByBottomPanelTabId }
            delete nextGroupByBottomPanelTabId[sourceTabId]
            return { groupByBottomPanelTabId: nextGroupByBottomPanelTabId }
          }

          const nextGroupByBottomPanelTabId = { ...state.groupByBottomPanelTabId }
          delete nextGroupByBottomPanelTabId[sourceTabId]

          const nextGroupsById = { ...state.groupsById }
          const nextGroupIdBySessionId = { ...state.groupIdBySessionId }

          const sourceSessionIds = sourceGroup.sessionIds.filter((sessionId) =>
            Boolean(state.sessionsById[sessionId])
          )

          const targetGroupId = nextGroupByBottomPanelTabId[targetTabId]
          const targetGroup = targetGroupId ? (nextGroupsById[targetGroupId] ?? null) : null

          if (!targetGroupId || !targetGroup) {
            const nextActiveSessionId =
              sourceGroup.activeSessionId && sourceSessionIds.includes(sourceGroup.activeSessionId)
                ? sourceGroup.activeSessionId
                : (sourceSessionIds[0] ?? null)

            const layoutSessionIds = getLayoutSessionIds(sourceGroup.layout).filter((sessionId) =>
              sourceSessionIds.includes(sessionId)
            )
            const nextLayout =
              layoutSessionIds.length > 0
                ? sourceGroup.layout
                : nextActiveSessionId
                  ? (nextActiveSessionId as TerminalSessionId)
                  : null

            nextGroupByBottomPanelTabId[targetTabId] = sourceGroupId
            nextGroupsById[sourceGroupId] = {
              ...sourceGroup,
              layout: nextLayout,
              activeSessionId: nextActiveSessionId,
              sessionIds: sourceSessionIds
            }

            for (const [sessionId, groupId] of Object.entries(nextGroupIdBySessionId)) {
              if (groupId === sourceGroupId) {
                delete nextGroupIdBySessionId[sessionId]
              }
            }

            for (const sessionId of sourceSessionIds) {
              nextGroupIdBySessionId[sessionId] = sourceGroupId
            }

            return {
              groupByBottomPanelTabId: nextGroupByBottomPanelTabId,
              groupsById: nextGroupsById,
              groupIdBySessionId: nextGroupIdBySessionId
            }
          }

          if (sourceGroupId === targetGroupId) {
            return {
              groupByBottomPanelTabId: nextGroupByBottomPanelTabId
            }
          }

          const targetSessionIds = targetGroup.sessionIds.filter((sessionId) =>
            Boolean(state.sessionsById[sessionId])
          )
          const mergedSessionIds = [...targetSessionIds]
          for (const sessionId of sourceSessionIds) {
            if (!mergedSessionIds.includes(sessionId)) {
              mergedSessionIds.push(sessionId)
            }
          }

          const nextTargetActiveSessionId =
            targetGroup.activeSessionId && mergedSessionIds.includes(targetGroup.activeSessionId)
              ? targetGroup.activeSessionId
              : (mergedSessionIds[0] ?? null)

          const visibleTargetLayoutIds = getLayoutSessionIds(targetGroup.layout).filter(
            (sessionId) => mergedSessionIds.includes(sessionId)
          )
          const nextTargetLayout =
            visibleTargetLayoutIds.length > 0
              ? targetGroup.layout
              : nextTargetActiveSessionId
                ? (nextTargetActiveSessionId as TerminalSessionId)
                : null

          nextGroupsById[targetGroupId] = {
            ...targetGroup,
            layout: nextTargetLayout,
            activeSessionId: nextTargetActiveSessionId,
            sessionIds: mergedSessionIds
          }

          delete nextGroupsById[sourceGroupId]
          for (const [tabId, mappedGroupId] of Object.entries(nextGroupByBottomPanelTabId)) {
            if (mappedGroupId === sourceGroupId) {
              delete nextGroupByBottomPanelTabId[tabId]
            }
          }

          for (const [sessionId, groupId] of Object.entries(nextGroupIdBySessionId)) {
            if (groupId === sourceGroupId) {
              delete nextGroupIdBySessionId[sessionId]
            }
          }

          for (const sessionId of mergedSessionIds) {
            nextGroupIdBySessionId[sessionId] = targetGroupId
          }

          return {
            groupByBottomPanelTabId: nextGroupByBottomPanelTabId,
            groupsById: nextGroupsById,
            groupIdBySessionId: nextGroupIdBySessionId
          }
        })
      },

      detachBottomPanelTab: async (tabId) => {
        const state = get()
        const groupId = state.groupByBottomPanelTabId[tabId]
        if (!groupId) return

        const group = state.groupsById[groupId]
        const sessionIds = group?.sessionIds ?? []

        const nextGroupByBottomTab = { ...state.groupByBottomPanelTabId }
        delete nextGroupByBottomTab[tabId]

        const nextGroups = { ...state.groupsById }
        delete nextGroups[groupId]

        const nextGroupIdBySession = { ...state.groupIdBySessionId }
        for (const sessionId of sessionIds) {
          if (nextGroupIdBySession[sessionId] === groupId) {
            delete nextGroupIdBySession[sessionId]
          }
        }

        set((current) => ({
          groupByBottomPanelTabId: nextGroupByBottomTab,
          groupsById: nextGroups,
          groupIdBySessionId: nextGroupIdBySession,
          focusedSessionId:
            current.focusedSessionId && sessionIds.includes(current.focusedSessionId)
              ? null
              : current.focusedSessionId,
          isTerminalFocus:
            current.focusedSessionId && sessionIds.includes(current.focusedSessionId)
              ? false
              : current.isTerminalFocus,
          isTerminalTextFocus:
            current.focusedSessionId && sessionIds.includes(current.focusedSessionId)
              ? false
              : current.isTerminalTextFocus
        }))

        const editorMap = get().sessionByEditorPath

        for (const sessionId of sessionIds) {
          if (
            get().sessionsById[sessionId] &&
            !isSessionReferenced(sessionId, nextGroupIdBySession, editorMap)
          ) {
            await get().killSession(sessionId)
          }
        }
      },

      detachEditorPath: async (path) => {
        const state = get()
        const sessionId =
          state.sessionByEditorPath[path] ||
          (isTerminalEditorPath(path) ? getTerminalEditorId(path) : '')
        if (!sessionId) return

        const nextEditorMap = { ...state.sessionByEditorPath }
        delete nextEditorMap[path]
        set({ sessionByEditorPath: nextEditorMap })

        if (
          get().sessionsById[sessionId] &&
          !isSessionReferenced(sessionId, get().groupIdBySessionId, nextEditorMap)
        ) {
          await get().killSession(sessionId)
        }
      },

      getGroupForBottomPanelTab: (tabId) => {
        const groupId = get().groupByBottomPanelTabId[tabId]
        if (!groupId) return null
        return get().groupsById[groupId] ?? null
      },

      getSessionIdsForBottomPanelTab: (tabId) => {
        const state = get()
        const groupId = state.groupByBottomPanelTabId[tabId]
        if (!groupId) return []

        const group = state.groupsById[groupId]
        if (!group) return []

        return group.sessionIds.filter((sessionId) => Boolean(state.sessionsById[sessionId]))
      },

      getSessionTreeForBottomPanelTab: (tabId) => {
        const state = get()
        const groupId = state.groupByBottomPanelTabId[tabId]
        if (!groupId) return []

        const group = state.groupsById[groupId]
        if (!group) return []

        return flattenGroupSessionTree(group.layout, group.sessionIds).filter((item) =>
          Boolean(state.sessionsById[item.sessionId])
        )
      },

      getBottomPanelTabIdForSession: (sessionId) => {
        const state = get()
        return findBottomPanelTabIdForSession(
          sessionId,
          state.groupIdBySessionId,
          state.groupByBottomPanelTabId
        )
      },

      getSessionForBottomPanelTab: (tabId) => {
        const state = get()
        const groupId = state.groupByBottomPanelTabId[tabId]
        if (!groupId) return null

        const group = state.groupsById[groupId]
        if (!group) return null

        const activeSessionId = resolveGroupActiveSession(group, state.sessionsById)
        if (!activeSessionId) return null

        return state.sessionsById[activeSessionId] ?? null
      },

      getSessionForEditorPath: (path) => {
        const mapped = get().sessionByEditorPath[path]
        const parsed = isTerminalEditorPath(path) ? getTerminalEditorId(path) : ''
        const sessionId = mapped || parsed
        if (!sessionId) return null
        return get().sessionsById[sessionId] ?? null
      },

      getSession: (sessionId) => {
        return get().sessionsById[sessionId] ?? null
      },

      getBuffer: (sessionId) => {
        return get().bufferBySessionId[sessionId] ?? ''
      },

      getBellVersion: (sessionId) => {
        return get().bellVersionBySessionId[sessionId] ?? 0
      },

      restartSession: async (sessionId) => {
        const pending = pendingRestartBySessionId.get(sessionId)
        if (pending) {
          return pending
        }

        const restartPromise = (async () => {
          const state = get()
          const previous = state.sessionsById[sessionId]
          const surface =
            previous?.surface ??
            resolveSessionSurface(sessionId, state.groupIdBySessionId, state.sessionByEditorPath)

          const created = await terminalClient.createSession({
            surface,
            name: previous?.name ?? undefined,
            cwd: previous?.cwd ?? undefined,
            shellPath: previous?.shellPath ?? undefined,
            shellArgs: previous?.shellArgs ?? undefined,
            cols: previous?.cols,
            rows: previous?.rows
          })

          clearPendingResize(sessionId)

          set((current) => {
            const nextSessions = { ...current.sessionsById }
            delete nextSessions[sessionId]
            nextSessions[created.id] = created

            const nextBuffers = { ...current.bufferBySessionId }
            delete nextBuffers[sessionId]
            nextBuffers[created.id] = ''

            const nextBells = { ...current.bellVersionBySessionId }
            delete nextBells[sessionId]
            nextBells[created.id] = 0

            const nextEditorMap = replaceMappedSessionId(
              current.sessionByEditorPath,
              sessionId,
              created.id
            )

            const nextGroupIdBySession = { ...current.groupIdBySessionId }
            const mappedGroupId = nextGroupIdBySession[sessionId]
            delete nextGroupIdBySession[sessionId]
            if (mappedGroupId) {
              nextGroupIdBySession[created.id] = mappedGroupId
            }

            const nextGroups = { ...current.groupsById }
            if (mappedGroupId) {
              const mappedGroup = nextGroups[mappedGroupId]
              if (mappedGroup) {
                const nextSessionIds = mappedGroup.sessionIds.map((candidateSessionId) =>
                  candidateSessionId === sessionId ? created.id : candidateSessionId
                )
                nextGroups[mappedGroupId] = {
                  ...mappedGroup,
                  layout: replaceSessionInLayout(mappedGroup.layout, sessionId, created.id),
                  sessionIds: nextSessionIds,
                  activeSessionId:
                    mappedGroup.activeSessionId === sessionId
                      ? created.id
                      : mappedGroup.activeSessionId
                }
              }
            }

            return {
              sessionsById: nextSessions,
              bufferBySessionId: nextBuffers,
              bellVersionBySessionId: nextBells,
              sessionByEditorPath: nextEditorMap,
              groupsById: nextGroups,
              groupIdBySessionId: nextGroupIdBySession,
              focusedSessionId:
                current.focusedSessionId === sessionId ? created.id : current.focusedSessionId
            }
          })

          await terminalClient.kill(sessionId).catch(() => {})

          return created
        })()

        pendingRestartBySessionId.set(sessionId, restartPromise)
        try {
          return await restartPromise
        } finally {
          pendingRestartBySessionId.delete(sessionId)
        }
      },

      write: async (sessionId, data) => {
        if (!data) return

        let targetSessionId = sessionId
        const current = get().sessionsById[sessionId]

        if (!current || current.exited) {
          const restarted = await get().restartSession(sessionId)
          targetSessionId = restarted.id
        }

        try {
          await terminalClient.write(targetSessionId, data)
        } catch (error) {
          if (!isRecoverableWriteError(error)) {
            throw error
          }

          const restarted = await get().restartSession(targetSessionId)
          await terminalClient.write(restarted.id, data)
        }
      },

      queueResize: (sessionId, cols, rows) => {
        pendingResizeBySessionId.set(sessionId, { cols, rows })
        const existingTimer = resizeTimerBySessionId.get(sessionId)
        if (existingTimer) {
          window.clearTimeout(existingTimer)
        }
        const timer = window.setTimeout(() => {
          const next = pendingResizeBySessionId.get(sessionId)
          if (next) {
            void terminalClient.resize(sessionId, next.cols, next.rows)
          }
          pendingResizeBySessionId.delete(sessionId)
          resizeTimerBySessionId.delete(sessionId)
        }, RESIZE_THROTTLE_MS)
        resizeTimerBySessionId.set(sessionId, timer)
      },

      updateSessionMeta: async (sessionId, patch) => {
        const summary = await terminalClient.updateSessionMeta(sessionId, patch)
        set((state) => ({
          sessionsById: {
            ...state.sessionsById,
            [sessionId]: summary
          }
        }))
      },

      clearBuffer: async (sessionId) => {
        await terminalClient.clearBuffer(sessionId)
        set((state) => ({
          bufferBySessionId: {
            ...state.bufferBySessionId,
            [sessionId]: ''
          }
        }))
      },

      killSession: async (sessionId) => {
        await terminalClient.kill(sessionId).catch(() => {})
        clearPendingResize(sessionId)
        pendingRestartBySessionId.delete(sessionId)

        set((state) => {
          const nextSessions = { ...state.sessionsById }
          delete nextSessions[sessionId]

          const nextBuffers = { ...state.bufferBySessionId }
          delete nextBuffers[sessionId]

          const nextBells = { ...state.bellVersionBySessionId }
          delete nextBells[sessionId]

          const cleanup = removeSessionAssociations(state, sessionId)

          return {
            ...cleanup,
            sessionsById: nextSessions,
            bufferBySessionId: nextBuffers,
            bellVersionBySessionId: nextBells
          }
        })
      },

      updateSettings: async (patch) => {
        const settings = await terminalClient.updateSettings(patch)
        set({ settings })
      },

      setFocusedSession: (sessionId) => {
        set({
          focusedSessionId: sessionId,
          isTerminalFocus: Boolean(sessionId)
        })
      },

      setTerminalTextFocus: (value) => {
        set({ isTerminalTextFocus: value })
      },

      syncBottomPanelTabIds: async (tabIds) => {
        const state = get()
        const keep = new Set(tabIds)
        const orphanedTabIds = Object.keys(state.groupByBottomPanelTabId).filter(
          (tabId) => !keep.has(tabId)
        )

        if (orphanedTabIds.length === 0) return

        for (const tabId of orphanedTabIds) {
          await get().detachBottomPanelTab(tabId)
        }
      },

      syncEditorPaths: async (paths) => {
        const state = get()
        const keep = new Set(paths)
        const orphanedPaths = Object.keys(state.sessionByEditorPath).filter(
          (path) => !keep.has(path)
        )
        if (orphanedPaths.length === 0) return

        for (const path of orphanedPaths) {
          await get().detachEditorPath(path)
        }
      }
    }),
    {
      name: 'onpoint.terminal.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedTerminalState => ({
        settings: state.settings,
        groupByBottomPanelTabId: state.groupByBottomPanelTabId,
        groupsById: state.groupsById,
        sessionByEditorPath: state.sessionByEditorPath
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedTerminalState>

        let groupByBottomPanelTabId = normalizeStringMapping(persisted.groupByBottomPanelTabId)
        let groupsById = normalizePersistedGroups(persisted.groupsById)

        if (
          Object.keys(groupByBottomPanelTabId).length === 0 &&
          persisted.sessionByBottomPanelTabId
        ) {
          const migrated = migrateLegacyBottomPanelMap(persisted.sessionByBottomPanelTabId)
          groupByBottomPanelTabId = migrated.groupByBottomPanelTabId
          groupsById = migrated.groupsById
        }

        const pruned = pruneOrphanGroups(groupByBottomPanelTabId, groupsById)
        groupByBottomPanelTabId = pruned.groupByBottomPanelTabId
        groupsById = pruned.groupsById

        const groupIdBySessionId = buildGroupIdBySessionId(groupsById, groupByBottomPanelTabId)

        return {
          ...currentState,
          settings: persisted.settings
            ? { ...DEFAULT_TERMINAL_SETTINGS, ...persisted.settings }
            : currentState.settings,
          groupByBottomPanelTabId,
          groupsById,
          groupIdBySessionId,
          sessionByEditorPath:
            persisted.sessionByEditorPath && typeof persisted.sessionByEditorPath === 'object'
              ? normalizeStringMapping(persisted.sessionByEditorPath)
              : currentState.sessionByEditorPath
        }
      }
    }
  )
)
