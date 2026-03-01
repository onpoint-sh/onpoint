import { useCallback, useEffect, useRef } from 'react'
import { Mosaic, type MosaicNode } from 'react-mosaic-component'
import { useDragDropManager } from 'react-dnd'
import {
  BOTTOM_PANEL_MIN_HEIGHT,
  getBottomPanelMaxHeight,
  useBottomPanelStore
} from '@/stores/bottom-panel-store'
import { BottomPanelPane } from './bottom-panel-pane'

function BottomPanel(): React.JSX.Element | null {
  const isOpen = useBottomPanelStore((state) => state.isOpen)
  const height = useBottomPanelStore((state) => state.height)
  const isFocused = useBottomPanelStore((state) => state.isFocused)
  const layout = useBottomPanelStore((state) => state.layout)
  const focusRequestId = useBottomPanelStore((state) => state.focusRequestId)
  const setHeight = useBottomPanelStore((state) => state.setHeight)
  const setFocused = useBottomPanelStore((state) => state.setFocused)
  const consumeFocusRequest = useBottomPanelStore((state) => state.consumeFocusRequest)
  const updateLayout = useBottomPanelStore((state) => state.updateLayout)
  const cycleTabs = useBottomPanelStore((state) => state.cycleTabs)

  const dndManager = useDragDropManager()
  const panelRef = useRef<HTMLDivElement>(null)
  const cleanupResizeRef = useRef<(() => void) | null>(null)
  const maxHeight = getBottomPanelMaxHeight()

  useEffect(() => {
    return () => {
      cleanupResizeRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!focusRequestId || !isOpen) return

    panelRef.current?.focus({ preventScroll: true })
    setFocused(true)
    consumeFocusRequest(focusRequestId)
  }, [consumeFocusRequest, focusRequestId, isOpen, setFocused])

  useEffect(() => {
    if (!isOpen || !isFocused) return

    const handlePointerDown = (event: PointerEvent): void => {
      const panelNode = panelRef.current
      if (!panelNode) return
      const targetNode = event.target
      if (!(targetNode instanceof Node)) return
      if (panelNode.contains(targetNode)) return
      setFocused(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [isFocused, isOpen, setFocused])

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()

      const panelBottom = panelRef.current?.getBoundingClientRect().bottom ?? window.innerHeight

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        setHeight(panelBottom - moveEvent.clientY)
      }

      const stopResizing = (): void => {
        document.body.classList.remove('bottom-panel-resizing')
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', stopResizing)
        window.removeEventListener('pointercancel', stopResizing)
        cleanupResizeRef.current = null
      }

      cleanupResizeRef.current = stopResizing
      document.body.classList.add('bottom-panel-resizing')
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopResizing)
      window.addEventListener('pointercancel', stopResizing)
    },
    [setHeight]
  )

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHeight(height + 16)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHeight(height - 16)
      }
    },
    [height, setHeight]
  )

  const handlePanelKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return
      const hasPrimaryModifier = event.metaKey || event.ctrlKey
      if (!hasPrimaryModifier || event.repeat) return

      if (event.key === 'Tab') {
        event.preventDefault()
        cycleTabs(event.shiftKey ? 'prev' : 'next')
        return
      }

      if (event.key === 'PageDown') {
        event.preventDefault()
        cycleTabs('next')
        return
      }

      if (event.key === 'PageUp') {
        event.preventDefault()
        cycleTabs('prev')
      }
    },
    [cycleTabs]
  )

  const handleLayoutChange = useCallback(
    (nextLayout: MosaicNode<string> | null) => {
      updateLayout(nextLayout)
    },
    [updateLayout]
  )

  const renderTile = useCallback((paneId: string) => {
    return <BottomPanelPane paneId={paneId} />
  }, [])

  if (!isOpen) {
    return null
  }

  return (
    <section
      ref={panelRef}
      className="bottom-panel"
      style={{ height }}
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
      onFocusCapture={() => {
        setFocused(true)
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && panelRef.current?.contains(nextTarget)) {
          return
        }
        setFocused(false)
      }}
      data-focused={isFocused ? 'true' : undefined}
    >
      <div
        className="bottom-panel-resize-handle"
        role="separator"
        aria-label="Resize bottom panel"
        aria-orientation="horizontal"
        tabIndex={0}
        aria-valuemin={BOTTOM_PANEL_MIN_HEIGHT}
        aria-valuemax={maxHeight}
        aria-valuenow={Math.round(height)}
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKeyDown}
      />

      {layout === null ? (
        <div className="bottom-panel-empty-layout">Bottom panel layout is empty.</div>
      ) : (
        <div className="bottom-panel-mosaic mosaic-container">
          <Mosaic<string>
            renderTile={renderTile}
            value={layout}
            onChange={handleLayoutChange}
            dragAndDropManager={dndManager}
          />
        </div>
      )}
    </section>
  )
}

export { BottomPanel }
