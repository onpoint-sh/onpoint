import { FilePlus2, PanelLeft, Search } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@onpoint/ui'
import { GhostModeIndicator } from './ghost-mode-indicator'
import { WindowControls } from './window-controls'
import type { AppViewMode } from '@/stores/view-mode-store'

type CustomTitleBarProps = {
  isSidebarOpen: boolean
  onToggleSidebar?: () => void
  canCreateNote?: boolean
  onCreateNote?: () => void
  onOpenSearch?: () => void
  isGhostMode?: boolean
  viewMode: AppViewMode
  onViewModeChange?: (mode: AppViewMode) => void
}

function CustomTitleBar({
  isSidebarOpen,
  onToggleSidebar,
  canCreateNote = false,
  onCreateNote,
  onOpenSearch,
  isGhostMode = false,
  viewMode,
  onViewModeChange
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
      className="app-drag grid h-[var(--titlebar-height)] shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-sidebar px-[0.125rem] text-sidebar-foreground select-none"
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
            aria-label="Search files"
            title="Search files"
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
            aria-label="Create new file"
            title="Create new file"
            disabled={!canCreateNote}
            onClick={onCreateNote}
          >
            <FilePlus2 className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-center px-2">
        {onViewModeChange ? (
          <Tabs
            value={viewMode}
            onValueChange={(nextValue) => {
              if (nextValue === 'agents' || nextValue === 'editor') {
                onViewModeChange(nextValue)
              }
            }}
          >
            <TabsList
              aria-label="Workspace mode"
              className="app-no-drag h-6 rounded-[0.7rem] border border-border/75 bg-muted p-[1.5px] shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_90%,transparent)]"
            >
              <TabsTrigger
                value="agents"
                className="h-full min-w-[4.5rem] rounded-[0.55rem] px-2.5 py-0 text-[0.78rem] font-medium leading-none tracking-[0.01em] text-foreground/70 transition-[color,box-shadow,background-color,border-color] duration-150 hover:text-foreground/85 data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_color-mix(in_oklch,var(--foreground)_8%,transparent),0_1px_2px_color-mix(in_oklch,var(--foreground)_16%,transparent)]"
              >
                Agents
              </TabsTrigger>
              <TabsTrigger
                value="editor"
                className="h-full min-w-[4.5rem] rounded-[0.55rem] px-2.5 py-0 text-[0.78rem] font-medium leading-none tracking-[0.01em] text-foreground/70 transition-[color,box-shadow,background-color,border-color] duration-150 hover:text-foreground/85 data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_color-mix(in_oklch,var(--foreground)_8%,transparent),0_1px_2px_color-mix(in_oklch,var(--foreground)_16%,transparent)]"
              >
                Editor
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1">
        <GhostModeIndicator isActive={isGhostMode} />
        <WindowControls align="right" />
      </div>
    </header>
  )
}

export { CustomTitleBar }
export type { CustomTitleBarProps }
