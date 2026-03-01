import { SidebarLayout } from './sidebar-layout'
import { WindowFrame } from './window-frame'
import { CustomTitleBar } from '@/components/window/custom-title-bar'
import { useIconTheme } from '@/hooks/use-icon-theme'
import { useTheme } from '@/hooks/use-theme'
import { useTitlebarZoomCompensation } from '@/hooks/use-titlebar-zoom-compensation'
import { useLayoutStore } from '@/stores/layout-store'
import { useNotesStore } from '@/stores/notes-store'
import type { AppViewMode } from '@/stores/view-mode-store'

type AppShellProps = {
  children: React.ReactNode
  sidebarContent?: React.ReactNode
  onOpenSearch?: () => void
  isGhostMode?: boolean
  viewMode: AppViewMode
  onViewModeChange: (mode: AppViewMode) => void
}

function AppShell({
  children,
  sidebarContent,
  onOpenSearch,
  isGhostMode = false,
  viewMode,
  onViewModeChange
}: AppShellProps): React.JSX.Element {
  useTheme()
  useIconTheme()
  useTitlebarZoomCompensation()

  const hasSidebar = sidebarContent !== undefined
  const isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen)
  const sidebarWidth = useLayoutStore((state) => state.sidebarWidth)
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
  const setSidebarWidth = useLayoutStore((state) => state.setSidebarWidth)
  const createNote = useNotesStore((state) => state.createNote)
  const canCreateNote = useNotesStore(
    (state) => Boolean(state.config.vaultPath) && !state.isLoading
  )

  return (
    <WindowFrame>
      <CustomTitleBar
        isSidebarOpen={hasSidebar && isSidebarOpen}
        onToggleSidebar={hasSidebar ? toggleSidebar : undefined}
        canCreateNote={hasSidebar && canCreateNote}
        onCreateNote={hasSidebar ? () => void createNote() : undefined}
        onOpenSearch={onOpenSearch}
        isGhostMode={isGhostMode}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
      {hasSidebar ? (
        <SidebarLayout
          isSidebarOpen={isSidebarOpen}
          sidebarWidth={sidebarWidth}
          onSidebarWidthChange={setSidebarWidth}
          sidebarContent={sidebarContent}
        >
          {children}
        </SidebarLayout>
      ) : (
        <div className="flex-1 min-h-0">{children}</div>
      )}
    </WindowFrame>
  )
}

export { AppShell }
