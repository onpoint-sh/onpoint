import { useEffect } from 'react'

const TITLEBAR_ZOOM_COMPENSATION_VAR = '--titlebar-zoom-compensation'
const DEFAULT_ZOOM_FACTOR = 1

function toCompensationValue(zoomFactor: number): string {
  if (!Number.isFinite(zoomFactor) || zoomFactor <= 0) return '1'
  return (1 / zoomFactor).toFixed(4)
}

export function useTitlebarZoomCompensation(): void {
  useEffect(() => {
    const root = document.documentElement
    let isMounted = true
    let isSyncInFlight = false

    const applyCompensation = (zoomFactor: number): void => {
      root.style.setProperty(TITLEBAR_ZOOM_COMPENSATION_VAR, toCompensationValue(zoomFactor))
    }

    const syncCompensation = (): void => {
      if (!isMounted || isSyncInFlight) return
      isSyncInFlight = true

      void window.windowControls
        .getZoomFactor()
        .then((zoomFactor) => {
          if (!isMounted) return
          applyCompensation(zoomFactor)
        })
        .catch(() => {
          if (!isMounted) return
          applyCompensation(DEFAULT_ZOOM_FACTOR)
        })
        .finally(() => {
          isSyncInFlight = false
        })
    }

    applyCompensation(DEFAULT_ZOOM_FACTOR)
    syncCompensation()

    const unsubscribe = window.windowControls.onZoomFactorChanged((zoomFactor) => {
      if (!isMounted) return
      applyCompensation(zoomFactor)
    })

    const syncIntervalId = window.setInterval(syncCompensation, 250)
    window.addEventListener('resize', syncCompensation)

    return () => {
      isMounted = false
      unsubscribe()
      window.clearInterval(syncIntervalId)
      window.removeEventListener('resize', syncCompensation)
      root.style.removeProperty(TITLEBAR_ZOOM_COMPENSATION_VAR)
    }
  }, [])
}
