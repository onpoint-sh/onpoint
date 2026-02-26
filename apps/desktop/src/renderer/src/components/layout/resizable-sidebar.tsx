import { useEffect, useRef } from 'react'

type ResizableSidebarProps = {
  isOpen: boolean
  width: number
  onWidthChange: (width: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  children?: React.ReactNode
}

function ResizableSidebar({
  isOpen,
  width,
  onWidthChange,
  containerRef,
  children
}: ResizableSidebarProps): React.JSX.Element | null {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  if (!isOpen) {
    return null
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      const containerBounds = containerRef.current?.getBoundingClientRect()
      if (!containerBounds) return
      onWidthChange(moveEvent.clientX - containerBounds.left)
    }

    const stopResizing = (): void => {
      document.body.classList.remove('sidebar-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
      cleanupRef.current = null
    }

    cleanupRef.current = stopResizing
    document.body.classList.add('sidebar-resizing')
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)
  }

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onWidthChange(width - 16)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      onWidthChange(width + 16)
    }
  }

  return (
    <aside
      className="relative h-full shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      style={{ width }}
    >
      <div className="flex h-full flex-col overflow-hidden p-3">{children}</div>
      <div
        className="app-no-drag absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent transition-colors duration-[120ms] hover:bg-sidebar-border focus-visible:bg-sidebar-border focus-visible:outline-none"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleResizeKeyDown}
      />
    </aside>
  )
}

export { ResizableSidebar }
export type { ResizableSidebarProps }
