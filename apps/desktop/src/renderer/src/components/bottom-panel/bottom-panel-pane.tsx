import { useCallback, useRef, useState } from 'react'
import { useDrag, useDragLayer, useDrop } from 'react-dnd'
import type { MosaicDirection } from 'react-mosaic-component'
import {
  BOTTOM_PANEL_VIEW_DEFINITIONS,
  BOTTOM_PANEL_VIEW_DEFINITIONS_BY_ID
} from '@/bottom-panel/view-definitions'
import { TabCloseButton } from '@/components/common/tab-close-button'
import { useBottomPanelStore } from '@/stores/bottom-panel-store'
import { usePanesStore } from '@/stores/panes-store'
import { createTerminalEditorPath } from '@/lib/terminal-editor-tab'
import { BottomPanelViewContent } from './bottom-panel-view-content'
import {
  buildGlobalToolbarActions,
  buildViewToolbarActions,
  type BottomPanelToolbarAction
} from './toolbar-actions'
import { BOTTOM_PANEL_TAB_DND_TYPE, type BottomPanelTabDragItem } from '@/lib/bottom-panel-dnd'

type EdgePosition = 'left' | 'right' | 'top' | 'bottom'

type BottomPanelPaneProps = {
  paneId: string
}

function getEdgeFromPoint(rect: DOMRect, x: number, y: number): EdgePosition {
  const relX = (x - rect.left) / rect.width
  const relY = (y - rect.top) / rect.height
  if (relY < relX && relY < 1 - relX) return 'top'
  if (relY > relX && relY > 1 - relX) return 'bottom'
  if (relX < 0.5) return 'left'
  return 'right'
}

function DraggableBottomPanelTab({
  tabId,
  paneId,
  index,
  isActive,
  label,
  onActivate,
  onClose
}: {
  tabId: string
  paneId: string
  index: number
  isActive: boolean
  label: string
  onActivate: () => void
  onClose: () => void
}): React.JSX.Element {
  const reorderTab = useBottomPanelStore((state) => state.reorderTab)
  const moveTabToPane = useBottomPanelStore((state) => state.moveTabToPane)

  const [{ isDragging }, dragRef] = useDrag<
    BottomPanelTabDragItem,
    unknown,
    { isDragging: boolean }
  >({
    type: BOTTOM_PANEL_TAB_DND_TYPE,
    item: { tabId, paneId, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  })

  const [{ isOver }, dropRef] = useDrop<BottomPanelTabDragItem, unknown, { isOver: boolean }>({
    accept: BOTTOM_PANEL_TAB_DND_TYPE,
    hover(item) {
      if (item.paneId === paneId && item.index !== index) {
        reorderTab(paneId, item.index, index)
        item.index = index
      }
    },
    drop(item) {
      if (item.paneId !== paneId) {
        moveTabToPane(item.paneId, item.tabId, paneId)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  })

  const setRefs = (node: HTMLDivElement | null): void => {
    dragRef(node)
    dropRef(node)
  }

  return (
    <div
      ref={setRefs}
      className="bottom-panel-tab"
      data-active={isActive ? 'true' : undefined}
      data-dragging={isDragging ? 'true' : undefined}
      data-drop-target={isOver ? 'true' : undefined}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onActivate()
        }
      }}
    >
      <span className="bottom-panel-tab-label">{label}</span>
      <TabCloseButton
        className="bottom-panel-tab-close"
        iconClassName="pane-tab-bar-close-x size-3"
        label={`Close ${label}`}
        onClick={onClose}
      />
    </div>
  )
}

function SplitDropOverlay({
  onDrop
}: {
  onDrop: (item: BottomPanelTabDragItem, position: EdgePosition) => void
}): React.JSX.Element {
  const edgeRef = useRef<EdgePosition | null>(null)
  const [activeEdge, setActiveEdge] = useState<EdgePosition | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [{ isOver, canDrop }, dropRef] = useDrop<
    BottomPanelTabDragItem,
    unknown,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: BOTTOM_PANEL_TAB_DND_TYPE,
    hover(_item, monitor) {
      const offset = monitor.getClientOffset()
      const container = containerRef.current
      if (!offset || !container) return
      const edge = getEdgeFromPoint(container.getBoundingClientRect(), offset.x, offset.y)
      if (edge !== edgeRef.current) {
        edgeRef.current = edge
        setActiveEdge(edge)
      }
    },
    drop(item) {
      if (edgeRef.current) {
        onDrop(item, edgeRef.current)
      }
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
      className="bottom-panel-split-overlay"
    >
      {showHighlight ? (
        <div
          className={`bottom-panel-split-highlight bottom-panel-split-highlight-${activeEdge}`}
        />
      ) : null}
    </div>
  )
}

function BottomPanelPane({ paneId }: BottomPanelPaneProps): React.JSX.Element | null {
  const pane = useBottomPanelStore((state) => state.panes[paneId])
  const focusedPaneId = useBottomPanelStore((state) => state.focusedPaneId)
  const setFocused = useBottomPanelStore((state) => state.setFocused)
  const setFocusedPane = useBottomPanelStore((state) => state.setFocusedPane)
  const setActiveTab = useBottomPanelStore((state) => state.setActiveTab)
  const closeTab = useBottomPanelStore((state) => state.closeTab)
  const openView = useBottomPanelStore((state) => state.openView)
  const splitPane = useBottomPanelStore((state) => state.splitPane)
  const splitPaneWithTab = useBottomPanelStore((state) => state.splitPaneWithTab)
  const moveTabToPane = useBottomPanelStore((state) => state.moveTabToPane)
  const toggleMaximize = useBottomPanelStore((state) => state.toggleMaximize)
  const hidePanel = useBottomPanelStore((state) => state.hidePanel)
  const isMaximized = useBottomPanelStore((state) => state.isMaximized)
  const openEditorTab = usePanesStore((state) => state.openTab)
  const requestEditorFocus = usePanesStore((state) => state.requestEditorFocus)

  const isTabDragging = useDragLayer(
    (monitor) => monitor.isDragging() && monitor.getItemType() === BOTTOM_PANEL_TAB_DND_TYPE
  )

  const activeTab = pane?.tabs.find((tab) => tab.id === pane.activeTabId) ?? null

  const handleOpenAddViewMenu = useCallback(async () => {
    const clickedId = await window.contextMenu.show([
      ...BOTTOM_PANEL_VIEW_DEFINITIONS.map((view) => ({
        id: view.id,
        label: `New ${view.title}`
      })),
      { id: 'sep-editor', label: '', separator: true },
      { id: 'new-terminal-editor', label: 'New Terminal in Editor' }
    ])

    if (!clickedId) return

    if (clickedId === 'new-terminal-editor') {
      openEditorTab(createTerminalEditorPath())
      requestEditorFocus()
      return
    }

    const selectedView = BOTTOM_PANEL_VIEW_DEFINITIONS.find((view) => view.id === clickedId)
    if (!selectedView) return
    openView(selectedView.id, paneId, { allowDuplicate: true })
  }, [openEditorTab, openView, paneId, requestEditorFocus])

  const viewActions = buildViewToolbarActions({
    paneId,
    activeTab,
    api: {
      openView,
      splitPane,
      closeTab,
      toggleMaximize,
      hidePanel
    }
  })

  const globalActions = buildGlobalToolbarActions({
    isMaximized,
    onOpenAddViewMenu: () => {
      void handleOpenAddViewMenu()
    },
    api: {
      openView,
      splitPane,
      closeTab,
      toggleMaximize,
      hidePanel
    }
  })

  const [{ isOver }, centerDropRef] = useDrop<BottomPanelTabDragItem, unknown, { isOver: boolean }>(
    {
      accept: BOTTOM_PANEL_TAB_DND_TYPE,
      drop(item) {
        if (item.paneId !== paneId) {
          moveTabToPane(item.paneId, item.tabId, paneId)
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true })
      })
    }
  )

  const handleEdgeDrop = useCallback(
    (item: BottomPanelTabDragItem, position: EdgePosition) => {
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

      splitPaneWithTab(
        paneId,
        directionMap[position],
        positionMap[position],
        item.paneId,
        item.tabId
      )
    },
    [paneId, splitPaneWithTab]
  )

  if (!pane) return null

  const renderToolbarAction = (action: BottomPanelToolbarAction): React.JSX.Element => {
    const Icon = action.icon
    return (
      <button
        key={action.id}
        type="button"
        className="bottom-panel-toolbar-btn"
        data-tone={action.tone === 'danger' ? 'danger' : undefined}
        onClick={action.onTrigger}
        title={action.label}
        aria-label={action.label}
      >
        <Icon className="size-3.5" />
      </button>
    )
  }

  return (
    <section
      className="bottom-panel-pane"
      data-focused={focusedPaneId === paneId ? 'true' : undefined}
      data-drop-target={isOver ? 'true' : undefined}
      onMouseDown={() => {
        setFocusedPane(paneId)
        setFocused(true)
      }}
      onFocusCapture={() => {
        setFocusedPane(paneId)
        setFocused(true)
      }}
    >
      <header className="bottom-panel-tab-bar">
        <div className="bottom-panel-tab-bar-scroll">
          {pane.tabs.map((tab, index) => {
            const view = BOTTOM_PANEL_VIEW_DEFINITIONS_BY_ID[tab.viewId]
            const isActive = tab.id === pane.activeTabId
            return (
              <DraggableBottomPanelTab
                key={tab.id}
                tabId={tab.id}
                paneId={paneId}
                index={index}
                isActive={isActive}
                label={view.title}
                onActivate={() => {
                  setActiveTab(paneId, tab.id)
                }}
                onClose={() => {
                  closeTab(paneId, tab.id)
                }}
              />
            )
          })}
        </div>
        <div className="bottom-panel-toolbar">
          {viewActions.map(renderToolbarAction)}
          <div className="bottom-panel-toolbar-separator" />
          {globalActions.map(renderToolbarAction)}
        </div>
      </header>

      <div
        ref={(node) => {
          centerDropRef(node)
        }}
        className="bottom-panel-pane-body"
        data-dragging={isTabDragging ? 'true' : undefined}
      >
        {activeTab ? (
          <BottomPanelViewContent viewId={activeTab.viewId} />
        ) : (
          <div className="bottom-panel-empty-state">
            <h3 className="bottom-panel-empty-title">No panel view</h3>
            <p className="bottom-panel-empty-description">Open a panel tab to continue.</p>
          </div>
        )}

        <SplitDropOverlay onDrop={handleEdgeDrop} />
      </div>
    </section>
  )
}

export { BottomPanelPane }
export type { BottomPanelPaneProps }
