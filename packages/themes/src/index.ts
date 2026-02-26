export type ThemeType = 'light' | 'dark'

export type ThemeColors = {
  background: string
  foreground: string
  card: string
  'card-foreground': string
  popover: string
  'popover-foreground': string
  primary: string
  'primary-foreground': string
  secondary: string
  'secondary-foreground': string
  muted: string
  'muted-foreground': string
  accent: string
  'accent-foreground': string
  destructive: string
  'destructive-foreground': string
  border: string
  input: string
  ring: string
  sidebar: string
  'sidebar-foreground': string
  'sidebar-primary': string
  'sidebar-primary-foreground': string
  'sidebar-accent': string
  'sidebar-accent-foreground': string
  'sidebar-border': string
  'sidebar-ring': string
  'chart-1': string
  'chart-2': string
  'chart-3': string
  'chart-4': string
  'chart-5': string
  'code-background': string
  'code-foreground': string
}

export type ThemeDefinition = {
  id: string
  name: string
  type: ThemeType
  colors: ThemeColors
}

export type ThemeMode = 'auto' | 'light' | 'dark'

export type ThemePreferences = {
  mode: ThemeMode
  lightThemeId: string
  darkThemeId: string
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'auto',
  lightThemeId: 'default-light',
  darkThemeId: 'default-dark'
}

// Theme imports
import { defaultLight } from './default-light'
import { defaultDark } from './default-dark'
import { githubLight } from './github-light'
import { githubDark } from './github-dark'
import { oneDarkPro } from './one-dark-pro'
import { atomOneLight } from './atom-one-light'
import { minDark } from './min-dark'
import { minLight } from './min-light'
import { auraDark } from './aura-dark'
import { bear } from './bear'
import { discord } from './discord'
import { nightOwlLight } from './night-owl-light'

export const THEMES: readonly ThemeDefinition[] = [
  defaultLight,
  defaultDark,
  githubLight,
  githubDark,
  oneDarkPro,
  atomOneLight,
  minDark,
  minLight,
  auraDark,
  bear,
  discord,
  nightOwlLight
]

export const LIGHT_THEMES = THEMES.filter((t) => t.type === 'light')
export const DARK_THEMES = THEMES.filter((t) => t.type === 'dark')

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id)
}

export function resolveTheme(
  preferences: ThemePreferences,
  systemIsDark: boolean
): ThemeDefinition {
  const resolvedMode =
    preferences.mode === 'auto' ? (systemIsDark ? 'dark' : 'light') : preferences.mode

  const themeId =
    resolvedMode === 'dark' ? preferences.darkThemeId : preferences.lightThemeId

  return getThemeById(themeId) ?? (resolvedMode === 'dark' ? defaultDark : defaultLight)
}

export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement

  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value)
  }

  root.classList.toggle('dark', theme.type === 'dark')
}
