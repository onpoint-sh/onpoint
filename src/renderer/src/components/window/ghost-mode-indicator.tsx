import { Eye } from 'lucide-react'

type GhostModeIndicatorProps = {
  isActive: boolean
}

function GhostModeIndicator({ isActive }: GhostModeIndicatorProps): React.JSX.Element | null {
  if (!isActive) return null

  return (
    <div
      className="app-no-drag inline-flex items-center gap-1 rounded-[calc(var(--radius)-2px)] bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-accent-foreground"
      title="Ghost Mode is active — hidden from screen recording"
    >
      <Eye className="size-3" />
      <span>Ghost</span>
    </div>
  )
}

export { GhostModeIndicator }
