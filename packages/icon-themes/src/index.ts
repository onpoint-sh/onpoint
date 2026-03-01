import type { IconThemeId } from './resolver'

export type { IconThemeAdapter, IconThemeId } from './resolver'
export { loadIconTheme, getLoadedIconTheme, useIconThemeAdapter } from './resolver'

export type IconThemeDefinition = {
  id: IconThemeId
  name: string
}

export const ICON_THEMES: readonly IconThemeDefinition[] = [
  { id: 'material', name: 'Material' },
  { id: 'vscode-icons', name: 'VSCode Icons' },
  { id: 'jetbrains', name: 'JetBrains' }
] as const

export const DEFAULT_ICON_THEME_ID: IconThemeId = 'material'

export function getIconThemeById(id: string): IconThemeDefinition | undefined {
  return ICON_THEMES.find((t) => t.id === id)
}
