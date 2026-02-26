import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_DEFINITIONS_BY_ID,
  type ShortcutActionId,
  type ShortcutDefinition
} from '../../shared/shortcuts'

export const shortcutDefinitions: readonly ShortcutDefinition[] = SHORTCUT_DEFINITIONS

export const shortcutDefinitionsById: Record<ShortcutActionId, ShortcutDefinition> =
  SHORTCUT_DEFINITIONS_BY_ID

export const globalShortcutDefinitions: readonly ShortcutDefinition[] = SHORTCUT_DEFINITIONS.filter(
  (definition) => definition.scope === 'global'
)
