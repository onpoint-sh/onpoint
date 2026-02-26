import { useCallback, useRef, useState } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { X, Columns2, Rows2 } from 'lucide-react'
import { usePanesStore } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'

const TAB_DND_TYPE = 'PANE_TAB'

type TabDragItem = {
  tabId: string
  paneId: string
  index: number
}

type PaneTabBarProps = {
  paneId: string
}

function DraggableTab({
  tabId,
  paneId,
  index,
  relativePath,
  isActive,
  label,
  onClick,
  onMouseDown,
  onContextMenu,
  onClose
}: {
  tabId: string
  paneId: string
  index: number
  relativePath: string
  isActive: boolean
  label: string
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onClose: (e: React.MouseEvent) => void
}): React.JSX.Element {
  const reorderTab = usePanesStore((s) => s.reorderTab)
  const moveTabToPane = usePanesStore((s) => s.moveTabToPane)

  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag] = useDrag<TabDragItem, unknown, { isDragging: boolean }>({
    type: TAB_DND_TYPE,
    item: { tabId, paneId, index },
    end(_item, monitor) {
      if (monitor.didDrop()) return
      void window.windowControls.detachTab(relativePath).then((detached) => {
        if (detached) {
          usePanesStore.getState().closeTab(paneId, tabId)
        }
      })
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  })

  const [{ isOver }, drop] = useDrop<TabDragItem, unknown, { isOver: boolean }>({
    accept: TAB_DND_TYPE,
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

  drag(drop(ref))

  return (
    <div
      ref={ref}
      className="pane-tab-bar-tab"
      data-active={isActive}
      data-dragging={isDragging}
      data-drop-target={isOver}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      <span className="pane-tab-bar-tab-label">{label}</span>
      <button
        className="pane-tab-bar-tab-close"
        onClick={onClose}
        tabIndex={-1}
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

function PaneTabBar({ paneId }: PaneTabBarProps): React.JSX.Element | null {
  const pane = usePanesStore((s) => s.panes[paneId])
  const setActiveTab = usePanesStore((s) => s.setActiveTab)
  const closeTab = usePanesStore((s) => s.closeTab)
  const closeOtherTabs = usePanesStore((s) => s.closeOtherTabs)
  const splitPane = usePanesStore((s) => s.splitPane)
  const moveTabToPane = usePanesStore((s) => s.moveTabToPane)
  const notes = useNotesStore((s) => s.notes)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    tabId: string
  } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Drop target for the tab bar itself (drop into empty area)
  const [{ isOver: isBarOver }, barDropRef] = useDrop<TabDragItem, unknown, { isOver: boolean }>({
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

  const resolveTitle = useCallback(
    (relativePath: string): string => {
      const note = notes.find((n) => n.relativePath === relativePath)
      if (note) return note.title
      const parts = relativePath.split('/')
      const filename = parts[parts.length - 1]
      return filename.replace(/\.md$/, '')
    },
    [notes]
  )

  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(paneId, tabId)
    },
    [paneId, setActiveTab]
  )

  const handleTabClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation()
      closeTab(paneId, tabId)
    },
    [paneId, closeTab]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault()
        closeTab(paneId, tabId)
      }
    },
    [paneId, closeTab]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollContainerRef.current.scrollLeft += e.deltaY
    }
  }, [])

  if (!pane) return null

  return (
    <>
      <div className="pane-tab-bar" data-drop-target={isBarOver} onWheel={handleWheel}>
        <div ref={(node) => { barDropRef(node); scrollContainerRef.current = node }} className="pane-tab-bar-scroll">
          {pane.tabs.map((tab, index) => (
            <DraggableTab
              key={tab.id}
              tabId={tab.id}
              paneId={paneId}
              index={index}
              relativePath={tab.relativePath}
              isActive={tab.id === pane.activeTabId}
              label={resolveTitle(tab.relativePath)}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleMouseDown(e, tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClose={(e) => handleTabClose(e, tab.id)}
            />
          ))}
        </div>
        <div className="pane-tab-bar-actions">
          <button
            className="pane-tab-bar-action-btn"
            onClick={() => splitPane(paneId, 'row')}
            title="Split Right"
          >
            <Columns2 className="size-3.5" />
          </button>
          <button
            className="pane-tab-bar-action-btn"
            onClick={() => splitPane(paneId, 'column')}
            title="Split Down"
          >
            <Rows2 className="size-3.5" />
          </button>
        </div>
      </div>

      {contextMenu ? (
        <PaneTabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCloseTab={() => {
            closeTab(paneId, contextMenu.tabId)
            setContextMenu(null)
          }}
          onCloseOthers={() => {
            closeOtherTabs(paneId, contextMenu.tabId)
            setContextMenu(null)
          }}
          onCloseAll={() => {
            const tabIds = pane.tabs.map((t) => t.id)
            for (const id of tabIds) {
              closeTab(paneId, id)
            }
            setContextMenu(null)
          }}
        />
      ) : null}
    </>
  )
}

type PaneTabContextMenuProps = {
  x: number
  y: number
  onClose: () => void
  onCloseTab: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
}

function PaneTabContextMenu({
  x,
  y,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseAll
}: PaneTabContextMenuProps): React.JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover py-1 text-[0.78rem] text-popover-foreground shadow-md"
        style={{ left: x, top: y }}
      >
        <button
          className="flex w-full items-center px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
          onClick={onCloseTab}
        >
          Close
        </button>
        <button
          className="flex w-full items-center px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
          onClick={onCloseOthers}
        >
          Close Others
        </button>
        <button
          className="flex w-full items-center px-3 py-1.5 text-left text-destructive hover:bg-accent"
          onClick={onCloseAll}
        >
          Close All
        </button>
      </div>
    </>
  )
}

export { PaneTabBar, TAB_DND_TYPE, type TabDragItem }
