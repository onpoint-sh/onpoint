import { useEffect } from 'react'
import { ICON_THEMES, loadIconTheme } from '@onpoint/icon-themes'
import { useIconThemeStore } from '@/stores/icon-theme-store'

export function useIconTheme(): void {
  const iconThemeId = useIconThemeStore((s) => s.iconThemeId)

  // Load the active theme immediately
  useEffect(() => {
    void loadIconTheme(iconThemeId)
  }, [iconThemeId])

  // Preload all themes in the background for the settings preview
  useEffect(() => {
    for (const theme of ICON_THEMES) {
      void loadIconTheme(theme.id)
    }
  }, [])
}
