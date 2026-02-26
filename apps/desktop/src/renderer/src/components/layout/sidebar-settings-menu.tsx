import { ChevronRight, Settings } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function SidebarSettingsMenu(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const isSettingsPage = location.pathname === '/settings'

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      setIsOpen(false)
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = (): void => {
    setIsOpen((previous) => !previous)
  }

  const handleNavigateToSettings = (): void => {
    navigate('/settings')
    setIsOpen(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-8 flex-1" />
      <div ref={rootRef} className="app-no-drag relative grid gap-[0.4rem]">
        {isOpen ? (
          <div
            id={menuId}
            className="absolute right-0 bottom-[calc(100%+0.45rem)] left-0 rounded-[0.85rem] border border-sidebar-border bg-[color-mix(in_oklch,var(--sidebar)_78%,var(--background))] p-[0.45rem] shadow-[0_12px_24px_color-mix(in_oklch,black_20%,transparent)]"
            role="menu"
            aria-label="Sidebar settings menu"
          >
            <button
              type="button"
              role="menuitem"
              className={`flex h-[2.05rem] w-full items-center gap-[0.55rem] rounded-[0.55rem] border border-transparent bg-transparent px-[0.55rem] text-left text-[0.85rem] font-medium text-sidebar-foreground transition-[background-color,border-color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_72%,transparent)] focus-visible:border-sidebar-ring focus-visible:outline-none ${
                isSettingsPage
                  ? 'border-[color-mix(in_oklch,var(--sidebar-ring)_42%,var(--sidebar-border))] bg-[color-mix(in_oklch,var(--sidebar-accent)_95%,transparent)]'
                  : ''
              }`}
              onClick={handleNavigateToSettings}
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="flex min-h-[2.35rem] w-full items-center justify-between rounded-[0.78rem] border border-transparent bg-transparent px-[0.7rem] text-[0.92rem] font-medium text-sidebar-foreground transition-[background-color,border-color,color] duration-[140ms] hover:border-[color-mix(in_oklch,var(--sidebar-border)_78%,transparent)] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_84%,var(--sidebar))] focus-visible:border-sidebar-ring focus-visible:shadow-[0_0_0_2px_color-mix(in_oklch,var(--sidebar-ring)_35%,transparent)] focus-visible:outline-none"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onClick={handleToggle}
        >
          <span className="inline-flex items-center gap-2">
            <Settings className="size-4" />
            <span>Settings</span>
          </span>
          <ChevronRight
            className={`size-4 text-muted-foreground transition-transform duration-[140ms] ${isOpen ? '-rotate-90' : ''}`}
          />
        </button>
      </div>
    </div>
  )
}

export { SidebarSettingsMenu }
