import { useCallback, useEffect, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { Pin } from 'lucide-react'
import { useIconThemeAdapter } from '@onpoint/icon-themes'
import { isUntitledPath } from '@onpoint/shared/notes'
import { getFileExtension } from '@/lib/file-types'
import { createTerminalEditorPath, isTerminalEditorPath } from '@/lib/terminal-editor-tab'
import { BOTTOM_PANEL_TAB_DND_TYPE, type BottomPanelTabDragItem } from '@/lib/bottom-panel-dnd'
import { TabCloseButton } from '@/components/common/tab-close-button'
import { useBottomPanelStore } from '@/stores/bottom-panel-store'
import { useIconThemeStore } from '@/stores/icon-theme-store'
import { usePanesStore, findAdjacentPaneId } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'
import { useTerminalStore } from '@/stores/terminal-store'

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
  isDirty,
  isPinned,
  label,
  fileIconSvg,
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
  isDirty: boolean
  isPinned: boolean
  label: string
  fileIconSvg: string | undefined
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onClose: () => void
}): React.JSX.Element {
  const reorderTab = usePanesStore((s) => s.reorderTab)
  const moveTabToPane = usePanesStore((s) => s.moveTabToPane)

  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag] = useDrag<TabDragItem, unknown, { isDragging: boolean }>({
    type: TAB_DND_TYPE,
    item: { tabId, paneId, index },
    end(_item, monitor) {
      if (monitor.didDrop()) return
      if (isTerminalEditorPath(relativePath)) return
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

  useEffect(() => {
    drag(drop(ref))
  }, [drag, drop])

  return (
    <div
      ref={ref}
      className="pane-tab-bar-tab"
      data-active={isActive}
      data-dirty={isDirty}
      data-pinned={isPinned}
      data-dragging={isDragging}
      data-drop-target={isOver}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      {isPinned && <Pin className="pane-tab-bar-tab-pin size-3" />}
      {fileIconSvg && (
        <span className="pane-tab-bar-tab-icon" dangerouslySetInnerHTML={{ __html: fileIconSvg }} />
      )}
      <span className="pane-tab-bar-tab-label">{label}</span>
      <span className="pane-tab-bar-tab-dirty-dot" />
      <TabCloseButton className="tab-close-button" label={`Close ${label}`} onClick={onClose} />
    </div>
  )
}

function PaneTabBar({ paneId }: PaneTabBarProps): React.JSX.Element | null {
  const pane = usePanesStore((s) => s.panes[paneId])
  const dirtyTabs = usePanesStore((s) => s.dirtyTabs)
  const setActiveTab = usePanesStore((s) => s.setActiveTab)
  const closeTab = usePanesStore((s) => s.closeTab)
  const closeOtherTabs = usePanesStore((s) => s.closeOtherTabs)
  const splitPane = usePanesStore((s) => s.splitPane)
  const splitPaneWithTab = usePanesStore((s) => s.splitPaneWithTab)
  const moveTabToPane = usePanesStore((s) => s.moveTabToPane)
  const openUntitledTab = usePanesStore((s) => s.openUntitledTab)
  const pinTab = usePanesStore((s) => s.pinTab)
  const unpinTab = usePanesStore((s) => s.unpinTab)
  const requestCloseTab = usePanesStore((s) => s.requestCloseTab)
  const ensureGroupForBottomPanelTab = useTerminalStore((s) => s.ensureGroupForBottomPanelTab)
  const getSessionIdsForBottomPanelTab = useTerminalStore((s) => s.getSessionIdsForBottomPanelTab)
  const attachEditorPathToSession = useTerminalStore((s) => s.attachEditorPathToSession)
  const detachBottomPanelTab = useTerminalStore((s) => s.detachBottomPanelTab)
  const notes = useNotesStore((s) => s.notes)
  const iconThemeId = useIconThemeStore((s) => s.iconThemeId)
  const iconAdapter = useIconThemeAdapter(iconThemeId)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleBottomPanelTerminalDrop = useCallback(
    (item: BottomPanelTabDragItem) => {
      void (async () => {
        const bottomPanelState = useBottomPanelStore.getState()
        const sourcePane = bottomPanelState.panes[item.paneId]
        const sourceTab = sourcePane?.tabs.find((candidate) => candidate.id === item.tabId)
        if (!sourceTab || sourceTab.viewId !== 'terminal') return

        await ensureGroupForBottomPanelTab(item.tabId)
        let sessionIds = getSessionIdsForBottomPanelTab(item.tabId)
        if (sessionIds.length === 0) {
          const createdSessionId = await useTerminalStore
            .getState()
            .createSessionInGroup(item.tabId)
          sessionIds = [createdSessionId]
        }

        for (const sessionId of sessionIds) {
          const terminalPath = createTerminalEditorPath(sessionId)
          attachEditorPathToSession(terminalPath, sessionId)
          usePanesStore.getState().openTab(terminalPath, paneId)
        }

        await detachBottomPanelTab(item.tabId)
        bottomPanelState.closeTab(item.paneId, item.tabId)
      })()
    },
    [
      attachEditorPathToSession,
      detachBottomPanelTab,
      ensureGroupForBottomPanelTab,
      getSessionIdsForBottomPanelTab,
      paneId
    ]
  )

  // Drop target for the tab bar itself (drop into empty area)
  const [{ isOver: isBarOver }, barDropRef] = useDrop<
    TabDragItem | BottomPanelTabDragItem,
    unknown,
    { isOver: boolean }
  >({
    accept: [TAB_DND_TYPE, BOTTOM_PANEL_TAB_DND_TYPE],
    drop(item, monitor) {
      const itemType = monitor.getItemType()
      if (itemType === TAB_DND_TYPE) {
        const editorItem = item as TabDragItem
        if (editorItem.paneId !== paneId) {
          moveTabToPane(editorItem.paneId, editorItem.tabId, paneId)
        }
        return
      }

      if (itemType === BOTTOM_PANEL_TAB_DND_TYPE) {
        handleBottomPanelTerminalDrop(item as BottomPanelTabDragItem)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true })
    })
  })

  const resolveTitle = useCallback(
    (relativePath: string): string => {
      if (isTerminalEditorPath(relativePath)) return 'Terminal'
      if (isUntitledPath(relativePath)) return 'Untitled'
      const ext = getFileExtension(relativePath)
      const note = notes.find((n) => n.relativePath === relativePath)
      if (note) return `${note.title}${ext}`
      const parts = relativePath.split('/')
      const filename = parts[parts.length - 1]
      return filename
    },
    [notes]
  )

  const handleRequestClose = useCallback(
    (tabId: string) => {
      requestCloseTab(paneId, tabId)
    },
    [paneId, requestCloseTab]
  )

  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(paneId, tabId)
    },
    [paneId, setActiveTab]
  )

  const handleTabClose = useCallback(
    (tabId: string) => {
      handleRequestClose(tabId)
    },
    [handleRequestClose]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault()
        handleRequestClose(tabId)
      }
    },
    [handleRequestClose]
  )

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent, tabId: string) => {
      e.preventDefault()

      const tab = pane?.tabs.find((t) => t.id === tabId)
      const isPinned = Boolean(tab?.pinned)

      console.log('[ctx-menu] opening', { paneId, tabId, tab, pane: !!pane })

      const clickedId = await window.contextMenu.show([
        isPinned ? { id: 'unpin', label: 'Unpin Tab' } : { id: 'pin', label: 'Pin Tab' },
        { id: 'sep-1', label: '', separator: true },
        { id: 'close', label: 'Close' },
        { id: 'close-others', label: 'Close Others' },
        { id: 'close-all', label: 'Close All' },
        { id: 'sep-2', label: '', separator: true },
        { id: 'split-right', label: 'Split Right' },
        {
          id: 'split-move',
          label: 'Split && Move',
          submenu: [
            { id: 'split-up', label: 'Split Up' },
            { id: 'split-down', label: 'Split Down' },
            { id: 'split-left', label: 'Split Left' },
            { id: 'split-right-move', label: 'Split Right' },
            { id: 'sep-sm', label: '', separator: true },
            { id: 'move-above', label: 'Move Above' },
            { id: 'move-below', label: 'Move Below' },
            { id: 'move-left', label: 'Move Left' },
            { id: 'move-right', label: 'Move Right' }
          ]
        },
        { id: 'sep-3', label: '', separator: true },
        { id: 'move-to-window', label: 'Move into New Window' }
      ])

      console.log('[ctx-menu] clicked:', clickedId)

      try {
        switch (clickedId) {
          case 'pin':
            console.log('[ctx-menu] pinTab', paneId, tabId)
            pinTab(paneId, tabId)
            break
          case 'unpin':
            console.log('[ctx-menu] unpinTab', paneId, tabId)
            unpinTab(paneId, tabId)
            break
          case 'close':
            console.log('[ctx-menu] close', paneId, tabId)
            handleRequestClose(tabId)
            break
          case 'close-others':
            console.log('[ctx-menu] closeOtherTabs', paneId, tabId)
            closeOtherTabs(paneId, tabId)
            break
          case 'close-all':
            console.log('[ctx-menu] closeAll', paneId)
            for (const t of usePanesStore.getState().panes[paneId]?.tabs ?? []) {
              closeTab(paneId, t.id)
            }
            break
          case 'split-right':
            console.log('[ctx-menu] splitPane row', paneId)
            splitPane(paneId, 'row')
            break
          case 'split-up':
            console.log('[ctx-menu] splitPaneWithTab column/first', paneId, tabId)
            splitPaneWithTab(paneId, 'column', 'first', paneId, tabId)
            break
          case 'split-down':
            console.log('[ctx-menu] splitPaneWithTab column/second', paneId, tabId)
            splitPaneWithTab(paneId, 'column', 'second', paneId, tabId)
            break
          case 'split-left':
            console.log('[ctx-menu] splitPaneWithTab row/first', paneId, tabId)
            splitPaneWithTab(paneId, 'row', 'first', paneId, tabId)
            break
          case 'split-right-move':
            console.log('[ctx-menu] splitPaneWithTab row/second', paneId, tabId)
            splitPaneWithTab(paneId, 'row', 'second', paneId, tabId)
            break
          case 'move-above': {
            const state = usePanesStore.getState()
            const target = findAdjacentPaneId(state.layout, paneId, 'up')
            console.log('[ctx-menu] move-above', { target, layout: JSON.stringify(state.layout) })
            if (target) moveTabToPane(paneId, tabId, target)
            else splitPaneWithTab(paneId, 'column', 'first', paneId, tabId)
            break
          }
          case 'move-below': {
            const state = usePanesStore.getState()
            const target = findAdjacentPaneId(state.layout, paneId, 'down')
            console.log('[ctx-menu] move-below', { target, layout: JSON.stringify(state.layout) })
            if (target) moveTabToPane(paneId, tabId, target)
            else splitPaneWithTab(paneId, 'column', 'second', paneId, tabId)
            break
          }
          case 'move-left': {
            const state = usePanesStore.getState()
            const target = findAdjacentPaneId(state.layout, paneId, 'left')
            console.log('[ctx-menu] move-left', { target, layout: JSON.stringify(state.layout) })
            if (target) moveTabToPane(paneId, tabId, target)
            else splitPaneWithTab(paneId, 'row', 'first', paneId, tabId)
            break
          }
          case 'move-right': {
            const state = usePanesStore.getState()
            const target = findAdjacentPaneId(state.layout, paneId, 'right')
            console.log('[ctx-menu] move-right', { target, layout: JSON.stringify(state.layout) })
            if (target) moveTabToPane(paneId, tabId, target)
            else splitPaneWithTab(paneId, 'row', 'second', paneId, tabId)
            break
          }
          case 'move-to-window': {
            console.log('[ctx-menu] move-to-window', { tab })
            if (tab) {
              const detached = await window.windowControls.detachTab(tab.relativePath, true)
              console.log('[ctx-menu] detachTab result:', detached)
              if (detached) closeTab(paneId, tabId)
            }
            break
          }
          default:
            console.log('[ctx-menu] unhandled clickedId:', clickedId)
        }
      } catch (err) {
        console.error('[ctx-menu] error handling action:', clickedId, err)
      }
    },
    [
      paneId,
      pane,
      pinTab,
      unpinTab,
      handleRequestClose,
      closeOtherTabs,
      closeTab,
      splitPane,
      splitPaneWithTab,
      moveTabToPane
    ]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.pane-tab-bar-tab')) return
      openUntitledTab(paneId)
    },
    [paneId, openUntitledTab]
  )

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const tabBarRef = useRef<HTMLDivElement>(null)

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

  if (!pane) return null

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
        onDoubleClick={handleDoubleClick}
        onScroll={handleScroll}
      >
        {pane.tabs.map((tab, index) => {
          const fileName = tab.relativePath.split('/').pop() ?? tab.relativePath
          return (
            <DraggableTab
              key={tab.id}
              tabId={tab.id}
              paneId={paneId}
              index={index}
              relativePath={tab.relativePath}
              isActive={tab.id === pane.activeTabId}
              isDirty={Boolean(dirtyTabs[tab.id])}
              isPinned={Boolean(tab.pinned)}
              label={resolveTitle(tab.relativePath)}
              fileIconSvg={iconAdapter?.getFileIcon(fileName)}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleMouseDown(e, tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClose={() => handleTabClose(tab.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

type ConfirmDialogAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

type ConfirmDialogProps = {
  title: string
  description: string
  actions: ConfirmDialogAction[]
  onOverlayClick?: () => void
}

function ConfirmDialog({
  title,
  description,
  actions,
  onOverlayClick
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <>
      <div className="close-confirm-overlay" onClick={onOverlayClick} />
      <div className="close-confirm-dialog">
        <p className="close-confirm-title">{title}</p>
        <p className="close-confirm-description">{description}</p>
        <div className="close-confirm-actions">
          {actions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              className={`close-confirm-btn ${
                action.variant === 'primary'
                  ? 'close-confirm-btn-primary'
                  : 'close-confirm-btn-secondary'
              }`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

type CloseConfirmDialogProps = {
  label: string
  onSave: () => void
  onDontSave: () => void
  onCancel: () => void
}

function CloseConfirmDialog({
  label,
  onSave,
  onDontSave,
  onCancel
}: CloseConfirmDialogProps): React.JSX.Element {
  return (
    <ConfirmDialog
      title={`Do you want to save the changes you made to ${label}?`}
      description="Your changes will be lost if you don't save them."
      actions={[
        { label: 'Save', onClick: onSave, variant: 'primary' },
        { label: "Don't Save", onClick: onDontSave, variant: 'secondary' },
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' }
      ]}
      onOverlayClick={onCancel}
    />
  )
}

export {
  PaneTabBar,
  ConfirmDialog,
  CloseConfirmDialog,
  TAB_DND_TYPE,
  type TabDragItem,
  type ConfirmDialogAction,
  type ConfirmDialogProps
}
