import { useEffect, useSyncExternalStore } from 'react'
import { applyTheme, resolveTheme } from '@onpoint/themes'
import { useThemeStore } from '@/stores/theme-store'

function subscribeToSystemTheme(callback: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', callback)
    return () => mediaQuery.removeEventListener('change', callback)
  }

  const legacy = mediaQuery as MediaQueryList & {
    addListener?: (listener: () => void) => void
    removeListener?: (listener: () => void) => void
  }

  legacy.addListener?.(callback)
  return () => legacy.removeListener?.(callback)
}

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useTheme(): void {
  const mode = useThemeStore((s) => s.mode)
  const lightThemeId = useThemeStore((s) => s.lightThemeId)
  const darkThemeId = useThemeStore((s) => s.darkThemeId)

  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, getSystemIsDark)

  useEffect(() => {
    const theme = resolveTheme({ mode, lightThemeId, darkThemeId }, systemIsDark)
    applyTheme(theme)
  }, [mode, lightThemeId, darkThemeId, systemIsDark])
}
