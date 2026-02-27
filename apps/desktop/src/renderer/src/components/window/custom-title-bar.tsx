import { FilePlus2, PanelLeft, Search } from 'lucide-react'
import { GhostModeIndicator } from './ghost-mode-indicator'
import { WindowControls } from './window-controls'

type CustomTitleBarProps = {
  isSidebarOpen: boolean
  onToggleSidebar?: () => void
  canCreateNote?: boolean
  onCreateNote?: () => void
  onOpenSearch?: () => void
  isGhostMode?: boolean
}

function CustomTitleBar({
  isSidebarOpen,
  onToggleSidebar,
  canCreateNote = false,
  onCreateNote,
  onOpenSearch,
  isGhostMode = false
}: CustomTitleBarProps): React.JSX.Element {
  const platform = window.windowControls.platform
  const isMac = platform === 'darwin'

  const handleDoubleClick = (event: React.MouseEvent<HTMLElement>): void => {
    if ((event.target as HTMLElement).closest('.app-no-drag')) return
    if (isMac) return
    void window.windowControls.toggleMaximize()
  }

  return (
    <header
      className="app-drag flex h-[var(--titlebar-height)] shrink-0 items-center bg-sidebar px-[0.125rem] text-sidebar-foreground select-none"
      style={{ zoom: 'var(--titlebar-zoom-compensation, 1)' }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex min-w-0 items-center gap-1">
        <WindowControls align="left" />
        {onToggleSidebar ? (
          <button
            type="button"
            className="app-no-drag inline-flex items-center justify-center border border-transparent bg-transparent text-muted-foreground outline-none transition-[background-color,color,border-color] duration-[120ms] hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_2px_color-mix(in_oklch,var(--ring)_50%,transparent)]"
            style={{
              height: '1.75rem',
              width: '1.75rem',
              borderRadius: 'calc(var(--radius) - 2px)',
              marginLeft: isMac ? '0.5rem' : undefined,
              transform: isMac ? 'translateY(1px)' : undefined
            }}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-pressed={isSidebarOpen}
            onClick={onToggleSidebar}
          >
            <PanelLeft className="size-4" />
          </button>
        ) : null}
        {onOpenSearch ? (
          <button
            type="button"
            className="app-no-drag inline-flex items-center justify-center border border-transparent bg-transparent text-muted-foreground outline-none transition-[background-color,color,border-color] duration-[120ms] hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_2px_color-mix(in_oklch,var(--ring)_50%,transparent)]"
            style={{
              height: '1.75rem',
              width: '1.75rem',
              borderRadius: 'calc(var(--radius) - 2px)',
              transform: isMac ? 'translateY(1px)' : undefined
            }}
            aria-label="Search notes"
            title="Search notes"
            onClick={onOpenSearch}
          >
            <Search className="size-4" />
          </button>
        ) : null}
        {!isSidebarOpen && onCreateNote ? (
          <button
            type="button"
            className="app-no-drag inline-flex h-7 w-7 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent bg-transparent text-muted-foreground outline-none transition-[background-color,color,border-color] duration-[120ms] hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_2px_color-mix(in_oklch,var(--ring)_50%,transparent)] disabled:pointer-events-none disabled:opacity-45"
            style={{ transform: isMac ? 'translateY(1px)' : undefined }}
            aria-label="Create new note"
            title="Create new note"
            disabled={!canCreateNote}
            onClick={onCreateNote}
          >
            <FilePlus2 className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="pointer-events-none flex-1" />
      <div className="flex min-w-24 items-center justify-end gap-1">
        <GhostModeIndicator isActive={isGhostMode} />
        <WindowControls align="right" />
      </div>
    </header>
  )
}

export { CustomTitleBar }
export type { CustomTitleBarProps }
