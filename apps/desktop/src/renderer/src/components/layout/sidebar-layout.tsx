import { useRef } from 'react'
import { ResizableSidebar } from './resizable-sidebar'

type SidebarLayoutProps = {
  isSidebarOpen: boolean
  sidebarWidth: number
  onSidebarWidthChange: (width: number) => void
  sidebarContent?: React.ReactNode
  children?: React.ReactNode
}

function SidebarLayout({
  isSidebarOpen,
  sidebarWidth,
  onSidebarWidthChange,
  sidebarContent,
  children
}: SidebarLayoutProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      <ResizableSidebar
        isOpen={isSidebarOpen}
        width={sidebarWidth}
        onWidthChange={onSidebarWidthChange}
        containerRef={containerRef}
      >
        {sidebarContent ?? (
          <div className="flex-1 rounded-[calc(var(--radius)+2px)] bg-[color-mix(in_oklch,var(--sidebar-accent)_45%,transparent)]" />
        )}
      </ResizableSidebar>
      <main className="min-w-0 flex-1 overflow-auto bg-background">
        {children ?? (
          <div className="flex h-full items-center justify-center rounded-[var(--radius)] border border-dashed border-border text-sm text-muted-foreground">
            Main content
          </div>
        )}
      </main>
    </div>
  )
}

export { SidebarLayout }
export type { SidebarLayoutProps }
