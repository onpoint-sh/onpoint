import { useCallback, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { X } from 'lucide-react'
import { usePreviewStore } from '../store'
import { useAppPreview } from '../context'

export const TAB_DND_TYPE = 'PANE_TAB'

export type TabDragItem = {
  tabId: string
  paneId: string
  index: number
}

function DraggableTab({
  tabId,
  paneId,
  index,
  isActive,
  label,
  onClick,
  onMouseDown,
  onClose
}: {
  tabId: string
  paneId: string
  index: number
  isActive: boolean
  label: string
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
  onClose: (e: React.MouseEvent) => void
}): React.JSX.Element {
  const reorderTab = usePreviewStore((s) => s.reorderTab)
  const moveTabToPane = usePreviewStore((s) => s.moveTabToPane)

  const [{ isDragging }, drag] = useDrag<TabDragItem, unknown, { isDragging: boolean }>({
    type: TAB_DND_TYPE,
    item: { tabId, paneId, index },
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

  return (
    <div
      ref={(node) => {
        drag(drop(node))
      }}
      className="pane-tab-bar-tab"
      data-active={isActive}
      data-dragging={isDragging}
      data-drop-target={isOver}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      <span className="pane-tab-bar-tab-label">{label}</span>
      <button className="pane-tab-bar-tab-close" onClick={onClose} tabIndex={-1}>
        <X className="pane-tab-bar-close-x size-3" />
      </button>
    </div>
  )
}

type TabBarProps = {
  paneId: string
}

export function TabBar({ paneId }: TabBarProps): React.JSX.Element {
  const pane = usePreviewStore((s) => s.panes[paneId])
  const setActiveTab = usePreviewStore((s) => s.setActiveTab)
  const closeTab = usePreviewStore((s) => s.closeTab)
  const moveTabToPane = usePreviewStore((s) => s.moveTabToPane)
  const setFocusedPane = usePreviewStore((s) => s.setFocusedPane)
  const { notes } = useAppPreview()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

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
      setFocusedPane(paneId)
    },
    [paneId, setActiveTab, setFocusedPane]
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

  const updateScrollThumb = useCallback((el: HTMLElement) => {
    const bar = tabBarRef.current
    if (!bar) return
    if (el.scrollWidth <= el.clientWidth) {
      bar.style.setProperty('--scroll-thumb-width', '0px')
      return
    }
    const ratio = el.clientWidth / el.scrollWidth
    const thumbWidth = ratio * el.clientWidth
    const maxScroll = el.scrollWidth - el.clientWidth
    const scrollRatio = maxScroll > 0 ? el.scrollLeft / maxScroll : 0
    const thumbX = scrollRatio * (el.clientWidth - thumbWidth)
    bar.style.setProperty('--scroll-thumb-width', `${thumbWidth}px`)
    bar.style.setProperty('--scroll-thumb-x', `${thumbX}px`)
  }, [])

  const showScrollIndicator = useCallback(
    (el: HTMLElement) => {
      const bar = tabBarRef.current
      if (!bar) return
      bar.classList.add('is-scrolling')
      updateScrollThumb(el)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        bar.classList.remove('is-scrolling')
      }, 800)
    },
    [updateScrollThumb]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const el = scrollContainerRef.current
      if (!el) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
      }
      showScrollIndicator(el)
    },
    [showScrollIndicator]
  )

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    showScrollIndicator(el)
  }, [showScrollIndicator])

  if (!pane) return <div className="pane-tab-bar" />

  return (
    <div
      ref={tabBarRef}
      className="pane-tab-bar"
      data-drop-target={isBarOver}
      onWheel={handleWheel}
    >
      <div
        ref={(node) => {
          barDropRef(node)
          scrollContainerRef.current = node
        }}
        className="pane-tab-bar-scroll"
        onScroll={handleScroll}
      >
        {pane.tabs.map((tab, index) => (
          <DraggableTab
            key={tab.id}
            tabId={tab.id}
            paneId={paneId}
            index={index}
            isActive={tab.id === pane.activeTabId}
            label={resolveTitle(tab.relativePath)}
            onClick={() => handleTabClick(tab.id)}
            onMouseDown={(e) => handleMouseDown(e, tab.id)}
            onClose={(e) => handleTabClose(e, tab.id)}
          />
        ))}
      </div>
    </div>
  )
}
