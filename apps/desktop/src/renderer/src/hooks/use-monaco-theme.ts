import { useCallback, useEffect, useSyncExternalStore } from 'react'
import * as monaco from 'monaco-editor'
import { useThemeStore } from '@/stores/theme-store'

const THEME_NAME = 'onpoint'
type MonacoApi = typeof monaco

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

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(
    /rgba?\(\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/
  )
  if (!match) return null
  const r = Math.round(parseFloat(match[1]))
  const g = Math.round(parseFloat(match[2]))
  const b = Math.round(parseFloat(match[3]))
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  const a = match[4] !== undefined ? Math.round(parseFloat(match[4]) * 255) : undefined
  if (a !== undefined && Number.isNaN(a)) return null
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  if (a !== undefined && a < 255) {
    return hex + a.toString(16).padStart(2, '0')
  }
  return hex
}

function resolveColor(cssValue: string, fallback: string): string {
  if (!cssValue) return fallback

  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    if (!CSS.supports('color', cssValue)) {
      return fallback
    }
  }

  const el = document.createElement('div')
  el.style.color = ''
  el.style.color = cssValue
  if (!el.style.color) {
    return fallback
  }
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)

  if (!computed) {
    return fallback
  }

  const resolved = rgbToHex(computed)
  if (!resolved) {
    return fallback
  }

  return resolved
}

function defineAppTheme(monacoApi: MonacoApi, isDark: boolean): void {
  const bg = resolveColor(getCssVar('--code-background'), isDark ? '#1e1e1e' : '#f5f5f5')
  const fg = resolveColor(getCssVar('--code-foreground'), isDark ? '#d4d4d4' : '#1f2328')
  const mutedFg = resolveColor(getCssVar('--muted-foreground'), isDark ? '#858585' : '#6b7280')
  const border = resolveColor(getCssVar('--border'), isDark ? '#3f3f46' : '#d1d5db')
  const accent = resolveColor(getCssVar('--accent'), isDark ? '#2f2f37' : '#e5e7eb')
  const ring = resolveColor(getCssVar('--ring'), isDark ? '#8b8b9a' : '#9ca3af')
  const background = resolveColor(getCssVar('--background'), isDark ? '#171717' : '#ffffff')

  monacoApi.editor.defineTheme(THEME_NAME, {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': bg,
      'editor.foreground': fg,
      'editorLineNumber.foreground': mutedFg,
      'editorLineNumber.activeForeground': fg,
      'editor.selectionBackground': ring + '44',
      'editor.inactiveSelectionBackground': ring + '22',
      'editorCursor.foreground': fg,
      'editor.lineHighlightBackground': accent + (isDark ? '33' : '22'),
      'editorWidget.background': background,
      'editorWidget.border': border,
      'input.background': bg,
      'input.border': border,
      focusBorder: ring,
      'scrollbarSlider.background': mutedFg + '33',
      'scrollbarSlider.hoverBackground': mutedFg + '55',
      'scrollbarSlider.activeBackground': mutedFg + '77'
    }
  })
}

function applyMonacoTheme(monacoApi: MonacoApi, isDark: boolean): void {
  defineAppTheme(monacoApi, isDark)
  monacoApi.editor.setTheme(THEME_NAME)
}

export function useMonacoTheme(): {
  monacoTheme: string
  applyMonacoTheme: (m: MonacoApi) => void
} {
  const mode = useThemeStore((s) => s.mode)
  const lightThemeId = useThemeStore((s) => s.lightThemeId)
  const darkThemeId = useThemeStore((s) => s.darkThemeId)
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, getSystemIsDark)

  const applyThemeToMonaco = useCallback((monacoApi: MonacoApi): void => {
    const isDark = document.documentElement.classList.contains('dark')
    applyMonacoTheme(monacoApi, isDark)
  }, [])

  useEffect(() => {
    // Apply immediately and on next frame to catch CSS var updates from useTheme().
    applyThemeToMonaco(monaco)
    const frame = requestAnimationFrame(() => {
      applyThemeToMonaco(monaco)
    })

    return () => cancelAnimationFrame(frame)
  }, [applyThemeToMonaco, mode, lightThemeId, darkThemeId, systemIsDark])

  return {
    monacoTheme: THEME_NAME,
    applyMonacoTheme: applyThemeToMonaco
  }
}
