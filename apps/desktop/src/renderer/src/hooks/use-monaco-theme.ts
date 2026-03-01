import { useEffect, useSyncExternalStore } from 'react'
import * as monaco from 'monaco-editor'
import { useThemeStore } from '@/stores/theme-store'

const THEME_NAME = 'onpoint'

function subscribeToSystemTheme(callback: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(
    /rgba?\(\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/
  )
  if (!match) return '#000000'
  const r = Math.round(parseFloat(match[1]))
  const g = Math.round(parseFloat(match[2]))
  const b = Math.round(parseFloat(match[3]))
  const a = match[4] !== undefined ? Math.round(parseFloat(match[4]) * 255) : undefined
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  if (a !== undefined && a < 255) {
    return hex + a.toString(16).padStart(2, '0')
  }
  return hex
}

function resolveColor(cssValue: string): string {
  if (!cssValue) return '#000000'
  const el = document.createElement('div')
  el.style.color = cssValue
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)
  return rgbToHex(computed)
}

function defineAppTheme(isDark: boolean): void {
  const bg = resolveColor(getCssVar('--code-background'))
  const fg = resolveColor(getCssVar('--code-foreground'))
  const mutedFg = resolveColor(getCssVar('--muted-foreground'))
  const border = resolveColor(getCssVar('--border'))
  const accent = resolveColor(getCssVar('--accent'))
  const ring = resolveColor(getCssVar('--ring'))
  const background = resolveColor(getCssVar('--background'))

  monaco.editor.defineTheme(THEME_NAME, {
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

export function useMonacoTheme(): string {
  const mode = useThemeStore((s) => s.mode)
  const lightThemeId = useThemeStore((s) => s.lightThemeId)
  const darkThemeId = useThemeStore((s) => s.darkThemeId)
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, getSystemIsDark)

  const isDark = mode === 'dark' || (mode === 'auto' && systemIsDark)

  useEffect(() => {
    // Small delay to ensure CSS variables have been applied by useTheme
    const frame = requestAnimationFrame(() => {
      defineAppTheme(isDark)
    })
    return () => cancelAnimationFrame(frame)
  }, [isDark, mode, lightThemeId, darkThemeId])

  return THEME_NAME
}
