import { useCallback } from 'react'
import { useDragLayer, useDrop } from 'react-dnd'
import type { MosaicDirection } from 'react-mosaic-component'
import { usePanesStore } from '@/stores/panes-store'
import { PaneTabBar, TAB_DND_TYPE, type TabDragItem } from './pane-tab-bar'
import { PaneEditor } from './pane-editor'

type EdgePosition = 'left' | 'right' | 'top' | 'bottom'

function EdgeDropZone({
  position,
  paneId,
  onDrop
}: {
  position: EdgePosition
  paneId: string
  onDrop: (item: TabDragItem, position: EdgePosition) => void
}): React.JSX.Element {
  const [{ isOver, canDrop }, dropRef] = useDrop<TabDragItem, unknown, { isOver: boolean; canDrop: boolean }>({
    accept: TAB_DND_TYPE,
    canDrop(item) {
      // Don't allow splitting if dragging the only tab in this same pane
      if (item.paneId === paneId) {
        const pane = usePanesStore.getState().panes[paneId]
        if (pane && pane.tabs.length <= 1) return false
      }
      return true
    },
    drop(item) {
      onDrop(item, position)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  })

  return (
    <div
      ref={(node) => { dropRef(node) }}
      className={`edge-drop-zone edge-drop-zone-${position}`}
      data-over={isOver && canDrop}
    />
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

  // Detect if a tab drag is in progress (to enable edge drop zones)
  const isTabDragging = useDragLayer((monitor) =>
    monitor.isDragging() && monitor.getItemType() === TAB_DND_TYPE
  )

  const activeTab = pane?.tabs.find((t) => t.id === pane.activeTabId)
  const relativePath = activeTab?.relativePath ?? null

  const handleFocus = useCallback(() => {
    const currentFocused = usePanesStore.getState().focusedPaneId
    if (currentFocused !== paneId) {
      setFocusedPane(paneId)
    }
  }, [paneId, setFocusedPane])

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
        <PaneEditor relativePath={relativePath} />
        <EdgeDropZone position="left" paneId={paneId} onDrop={handleEdgeDrop} />
        <EdgeDropZone position="right" paneId={paneId} onDrop={handleEdgeDrop} />
        <EdgeDropZone position="top" paneId={paneId} onDrop={handleEdgeDrop} />
        <EdgeDropZone position="bottom" paneId={paneId} onDrop={handleEdgeDrop} />
      </div>
    </div>
  )
}

export { EditorPane }
