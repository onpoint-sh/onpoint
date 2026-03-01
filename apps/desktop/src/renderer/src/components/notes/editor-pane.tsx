import { useCallback, useRef, useState } from 'react'
import { useDragLayer, useDrop } from 'react-dnd'
import type { MosaicDirection } from 'react-mosaic-component'
import { usePanesStore } from '@/stores/panes-store'
import { useBottomPanelStore } from '@/stores/bottom-panel-store'
import { useTerminalStore } from '@/stores/terminal-store'
import { getFileType } from '@/lib/file-types'
import { BOTTOM_PANEL_TAB_DND_TYPE, type BottomPanelTabDragItem } from '@/lib/bottom-panel-dnd'
import { createTerminalEditorPath, isTerminalEditorPath } from '@/lib/terminal-editor-tab'
import { PaneTabBar, TAB_DND_TYPE, type TabDragItem } from './pane-tab-bar'
import { PaneEditor } from './pane-editor'
import { MermaidEditor } from './mermaid-editor'
import { CodeEditor } from './code-editor'
import { TerminalPaneEditor } from './terminal-pane-editor'

type EdgePosition = 'left' | 'right' | 'top' | 'bottom'

function getEdgeFromPoint(rect: DOMRect, x: number, y: number): EdgePosition {
  const relX = (x - rect.left) / rect.width
  const relY = (y - rect.top) / rect.height
  // Diagonal split: top-left→bottom-right (y=x) and top-right→bottom-left (y=1-x)
  if (relY < relX && relY < 1 - relX) return 'top'
  if (relY > relX && relY > 1 - relX) return 'bottom'
  if (relX < 0.5) return 'left'
  return 'right'
}

function SplitDropOverlay({
  paneId,
  onDrop
}: {
  paneId: string
  onDrop: (
    item: TabDragItem | BottomPanelTabDragItem,
    position: EdgePosition,
    itemType: string | symbol | null
  ) => void
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const edgeRef = useRef<EdgePosition | null>(null)
  const [activeEdge, setActiveEdge] = useState<EdgePosition | null>(null)

  const [{ isOver, canDrop }, dropRef] = useDrop<
    TabDragItem | BottomPanelTabDragItem,
    unknown,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: [TAB_DND_TYPE, BOTTOM_PANEL_TAB_DND_TYPE],
    canDrop(item, monitor) {
      if (monitor.getItemType() === TAB_DND_TYPE && item.paneId === paneId) {
        const pane = usePanesStore.getState().panes[paneId]
        if (pane && pane.tabs.length <= 1) return false
      }
      return true
    },
    hover(_item, monitor) {
      const offset = monitor.getClientOffset()
      const el = containerRef.current
      if (!offset || !el) return
      const edge = getEdgeFromPoint(el.getBoundingClientRect(), offset.x, offset.y)
      if (edge !== edgeRef.current) {
        edgeRef.current = edge
        setActiveEdge(edge)
      }
    },
    drop(item, monitor) {
      if (edgeRef.current) onDrop(item, edgeRef.current, monitor.getItemType())
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  })

  const showHighlight = isOver && canDrop && activeEdge

  return (
    <div
      ref={(node) => {
        containerRef.current = node
        dropRef(node)
      }}
      className="split-drop-overlay"
    >
      {showHighlight && (
        <div className={`split-drop-highlight split-drop-highlight-${activeEdge}`} />
      )}
    </div>
  )
}

type EditorPaneProps = {
  paneId: string
}

function EditorPane({ paneId }: EditorPaneProps): React.JSX.Element {
  const pane = usePanesStore((s) => s.panes[paneId])
  const setFocusedPane = usePanesStore((s) => s.setFocusedPane)
  const moveTabToPane = usePanesStore((s) => s.moveTabToPane)
  const splitPaneWithTab = usePanesStore((s) => s.splitPaneWithTab)
  const focusedPaneId = usePanesStore((s) => s.focusedPaneId)
  const focusRequestId = usePanesStore((s) => s.focusRequestsByPane[paneId] ?? 0)
  const consumeEditorFocusRequest = usePanesStore((s) => s.consumeEditorFocusRequest)
  const ensureGroupForBottomPanelTab = useTerminalStore((s) => s.ensureGroupForBottomPanelTab)
  const getSessionIdsForBottomPanelTab = useTerminalStore((s) => s.getSessionIdsForBottomPanelTab)
  const attachEditorPathToSession = useTerminalStore((s) => s.attachEditorPathToSession)
  const detachBottomPanelTab = useTerminalStore((s) => s.detachBottomPanelTab)

  const moveBottomPanelTerminalTabToPane = useCallback(
    async (item: BottomPanelTabDragItem, targetPaneId: string) => {
      const bottomPanelState = useBottomPanelStore.getState()
      const sourcePane = bottomPanelState.panes[item.paneId]
      const sourceTab = sourcePane?.tabs.find((candidate) => candidate.id === item.tabId)
      if (!sourceTab || sourceTab.viewId !== 'terminal') return

      await ensureGroupForBottomPanelTab(item.tabId)
      let sessionIds = getSessionIdsForBottomPanelTab(item.tabId)

      if (sessionIds.length === 0) {
        const createdSessionId = await useTerminalStore.getState().createSessionInGroup(item.tabId)
        sessionIds = [createdSessionId]
      }

      for (const sessionId of sessionIds) {
        const terminalPath = createTerminalEditorPath(sessionId)
        attachEditorPathToSession(terminalPath, sessionId)
        usePanesStore.getState().openTab(terminalPath, targetPaneId)
      }

      await detachBottomPanelTab(item.tabId)
      bottomPanelState.closeTab(item.paneId, item.tabId)
    },
    [
      attachEditorPathToSession,
      detachBottomPanelTab,
      ensureGroupForBottomPanelTab,
      getSessionIdsForBottomPanelTab
    ]
  )

  // Detect if a tab drag is in progress (to enable edge drop zones)
  const isTabDragging = useDragLayer(
    (monitor) =>
      monitor.isDragging() &&
      (monitor.getItemType() === TAB_DND_TYPE ||
        monitor.getItemType() === BOTTOM_PANEL_TAB_DND_TYPE)
  )

  const activeTab = pane?.tabs.find((t) => t.id === pane.activeTabId)
  const relativePath = activeTab?.relativePath ?? null
  const scopedFocusRequestId = focusedPaneId === paneId ? focusRequestId : 0

  const handleFocus = useCallback(() => {
    const currentFocused = usePanesStore.getState().focusedPaneId
    if (currentFocused !== paneId) {
      setFocusedPane(paneId)
    }
  }, [paneId, setFocusedPane])

  const handleFocusConsumed = useCallback(() => {
    if (scopedFocusRequestId) {
      consumeEditorFocusRequest(paneId, scopedFocusRequestId)
    }
  }, [consumeEditorFocusRequest, paneId, scopedFocusRequestId])

  // Center drop: move tab into this pane (no split)
  const [{ isOver }, centerDropRef] = useDrop<
    TabDragItem | BottomPanelTabDragItem,
    unknown,
    { isOver: boolean }
  >({
    accept: [TAB_DND_TYPE, BOTTOM_PANEL_TAB_DND_TYPE],
    drop(item, monitor) {
      const itemType = monitor.getItemType()
      if (itemType === TAB_DND_TYPE) {
        if (item.paneId !== paneId) {
          moveTabToPane(item.paneId, item.tabId, paneId)
        }
        return
      }

      if (itemType === BOTTOM_PANEL_TAB_DND_TYPE) {
        void (async () => {
          await moveBottomPanelTerminalTabToPane(item, paneId)
        })()
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true })
    })
  })

  const handleEdgeDrop = useCallback(
    (
      item: TabDragItem | BottomPanelTabDragItem,
      position: EdgePosition,
      itemType: string | symbol | null
    ) => {
      const directionMap: Record<EdgePosition, MosaicDirection> = {
        left: 'row',
        right: 'row',
        top: 'column',
        bottom: 'column'
      }
      const positionMap: Record<EdgePosition, 'first' | 'second'> = {
        left: 'first',
        right: 'second',
        top: 'first',
        bottom: 'second'
      }

      if (itemType === TAB_DND_TYPE) {
        splitPaneWithTab(
          paneId,
          directionMap[position],
          positionMap[position],
          item.paneId,
          item.tabId
        )
        return
      }

      void (async () => {
        const newPaneId = usePanesStore.getState().splitPane(paneId, directionMap[position])
        if (!newPaneId) return

        const panesState = usePanesStore.getState()
        const newPane = panesState.panes[newPaneId]
        const duplicatedTabId = newPane?.activeTabId ?? null
        await moveBottomPanelTerminalTabToPane(item, newPaneId)
        if (duplicatedTabId) {
          panesState.closeTab(newPaneId, duplicatedTabId)
        }
      })()
    },
    [moveBottomPanelTerminalTabToPane, paneId, splitPaneWithTab]
  )

  if (!pane) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        Pane not found
      </div>
    )
  }

  return (
    <div
      className="editor-pane"
      data-drop-target={isOver}
      onMouseDown={handleFocus}
      onFocusCapture={handleFocus}
    >
      <PaneTabBar paneId={paneId} />
      <div
        ref={(node) => {
          centerDropRef(node)
        }}
        className="editor-pane-body"
        data-dragging={isTabDragging}
      >
        {(() => {
          if (isTerminalEditorPath(relativePath)) {
            return (
              <TerminalPaneEditor
                key={activeTab?.id}
                tabId={activeTab?.id}
                relativePath={relativePath}
              />
            )
          }

          const fileType = relativePath ? getFileType(relativePath) : 'markdown'
          if (fileType === 'mermaid') {
            return (
              <MermaidEditor
                key={activeTab?.id}
                tabId={activeTab?.id}
                relativePath={relativePath}
                focusRequestId={scopedFocusRequestId}
                onFocusConsumed={handleFocusConsumed}
              />
            )
          }
          if (fileType === 'code') {
            return (
              <CodeEditor
                key={activeTab?.id}
                tabId={activeTab?.id}
                relativePath={relativePath}
                focusRequestId={scopedFocusRequestId}
                onFocusConsumed={handleFocusConsumed}
              />
            )
          }
          return (
            <PaneEditor
              key={activeTab?.id}
              tabId={activeTab?.id}
              relativePath={relativePath}
              focusRequestId={scopedFocusRequestId}
              onFocusConsumed={handleFocusConsumed}
            />
          )
        })()}
        <SplitDropOverlay paneId={paneId} onDrop={handleEdgeDrop} />
      </div>
    </div>
  )
}

export { EditorPane }
