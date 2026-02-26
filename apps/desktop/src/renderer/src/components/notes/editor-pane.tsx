import { useCallback, useRef, useState } from 'react'
import { useDragLayer, useDrop } from 'react-dnd'
import type { MosaicDirection } from 'react-mosaic-component'
import { usePanesStore } from '@/stores/panes-store'
import { PaneTabBar, TAB_DND_TYPE, type TabDragItem } from './pane-tab-bar'
import { PaneEditor } from './pane-editor'

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
  onDrop: (item: TabDragItem, position: EdgePosition) => void
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const edgeRef = useRef<EdgePosition | null>(null)
  const [activeEdge, setActiveEdge] = useState<EdgePosition | null>(null)

  const [{ isOver, canDrop }, dropRef] = useDrop<TabDragItem, unknown, { isOver: boolean; canDrop: boolean }>({
    accept: TAB_DND_TYPE,
    canDrop(item) {
      if (item.paneId === paneId) {
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
    drop(item) {
      if (edgeRef.current) onDrop(item, edgeRef.current)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  })

  const showHighlight = isOver && canDrop && activeEdge

  return (
    <div
      ref={(node) => { containerRef.current = node; dropRef(node) }}
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

  // Detect if a tab drag is in progress (to enable edge drop zones)
  const isTabDragging = useDragLayer((monitor) =>
    monitor.isDragging() && monitor.getItemType() === TAB_DND_TYPE
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
  const [{ isOver }, centerDropRef] = useDrop<TabDragItem, unknown, { isOver: boolean }>({
    accept: TAB_DND_TYPE,
    drop(item) {
      if (item.paneId !== paneId) {
        moveTabToPane(item.paneId, item.tabId, paneId)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true })
    })
  })

  const handleEdgeDrop = useCallback(
    (item: TabDragItem, position: EdgePosition) => {
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
      splitPaneWithTab(paneId, directionMap[position], positionMap[position], item.paneId, item.tabId)
    },
    [paneId, splitPaneWithTab]
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
      <div ref={(node) => { centerDropRef(node) }} className="editor-pane-body" data-dragging={isTabDragging}>
        <PaneEditor
          key={activeTab?.id}
          tabId={activeTab?.id}
          relativePath={relativePath}
          focusRequestId={scopedFocusRequestId}
          onFocusConsumed={handleFocusConsumed}
        />
        <SplitDropOverlay paneId={paneId} onDrop={handleEdgeDrop} />
      </div>
    </div>
  )
}

export { EditorPane }
