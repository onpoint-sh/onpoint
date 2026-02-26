import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import {
  GHOST_MODE_OPACITY_MIN,
  GHOST_MODE_OPACITY_MAX,
  GHOST_MODE_OPACITY_STEP
} from '@onpoint/shared'

type GhostModeIndicatorProps = {
  isActive: boolean
}

function GhostModeIndicator({ isActive }: GhostModeIndicatorProps): React.JSX.Element | null {
  const [opacity, setOpacity] = useState(0.85)

  useEffect(() => {
    if (!isActive) return
    window.ghostMode.getConfig().then((config) => setOpacity(config.opacity))
  }, [isActive])

  if (!isActive) return null

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseFloat(e.target.value)
    setOpacity(value)
    window.ghostMode.setOpacity(value)
  }

  return (
    <div
      className="app-no-drag inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-accent-foreground"
      title="Ghost Mode is active — hidden from screen recording"
    >
      <Eye className="size-3 shrink-0" />
      <span className="shrink-0">Ghost</span>
      <input
        type="range"
        min={GHOST_MODE_OPACITY_MIN}
        max={GHOST_MODE_OPACITY_MAX}
        step={GHOST_MODE_OPACITY_STEP}
        value={opacity}
        onChange={handleOpacityChange}
        className="ghost-opacity-slider w-14"
      />
      <span className="shrink-0 tabular-nums opacity-70">{Math.round(opacity * 100)}%</span>
    </div>
  )
}

export { GhostModeIndicator }
