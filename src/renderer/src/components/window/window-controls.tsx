import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type WindowControlsProps = {
  align: 'left' | 'right'
}

function WindowControls({ align }: WindowControlsProps): React.JSX.Element | null {
  const isMac = window.windowControls.platform === 'darwin'
  const shouldRenderMacSpacer = isMac && align === 'left'
  const shouldRenderDesktopButtons = !isMac && align === 'right'
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!shouldRenderDesktopButtons) return

    let isMounted = true
    const unsubscribe = window.windowControls.onMaximizeChanged((next) => {
      if (isMounted) setIsMaximized(next)
    })

    void window.windowControls.isMaximized().then((next) => {
      if (isMounted) setIsMaximized(next)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [shouldRenderDesktopButtons])

  if (shouldRenderMacSpacer) {
    return <div className="h-6 w-[72px] shrink-0" aria-hidden />
  }

  if (!shouldRenderDesktopButtons) {
    return null
  }

  return (
    <div className="app-no-drag flex items-stretch" role="group" aria-label="Window controls">
      <button
        type="button"
        className="inline-flex h-[var(--titlebar-height)] w-12 items-center justify-center border-0 bg-transparent text-muted-foreground outline-none transition-[background-color,color] duration-[120ms] hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
        aria-label="Minimize window"
        onClick={() => void window.windowControls.minimize()}
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        className="inline-flex h-[var(--titlebar-height)] w-12 items-center justify-center border-0 bg-transparent text-muted-foreground outline-none transition-[background-color,color] duration-[120ms] hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={() => {
          void window.windowControls.toggleMaximize()
        }}
      >
        {isMaximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
      </button>
      <button
        type="button"
        className="inline-flex h-[var(--titlebar-height)] w-12 items-center justify-center border-0 bg-transparent text-muted-foreground outline-none transition-[background-color,color] duration-[120ms] hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-destructive focus-visible:text-destructive-foreground"
        aria-label="Close window"
        onClick={() => void window.windowControls.close()}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export { WindowControls }
