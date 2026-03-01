export type ShortcutScope = 'window' | 'global'

export type ShortcutRuleSource = 'system' | 'user'
export type ShortcutWhen = string

export type ShortcutWhenPresetId =
  | 'window_focused'
  | 'window_except_markdown'
  | 'markdown_editor_only'

export type ShortcutWhenPreset = {
  id: ShortcutWhenPresetId
  label: string
  when: ShortcutWhen
}

export type ShortcutActionId =
  | 'toggle_sidebar'
  | 'toggle_bottom_panel'
  | 'open_settings'
  | 'open_folder'
  | 'create_note'
  | 'close_tab'
  | 'next_tab'
  | 'prev_tab'
  | 'reopen_closed_tab'
  | 'split_pane_right'
  | 'split_pane_down'
  | 'zoom_in'
  | 'zoom_out'
  | 'zoom_reset'
  | 'show_main_window'
  | 'toggle_ghost_mode'
  | 'new_window'
  | 'search'
  | 'new_terminal'
  | 'focus_terminal'
  | 'kill_terminal'
  | 'clear_terminal'
  | 'split_terminal'
  | 'split_terminal_right'
  | 'split_terminal_down'

export type ShortcutDefinition = {
  id: ShortcutActionId
  label: string
  description: string
  defaultAccelerator: string
  allowedScopes: readonly ShortcutScope[]
  defaultScope: ShortcutScope
  defaultWhen?: ShortcutWhen
  whenPresets: readonly ShortcutWhenPresetId[]
}

export type ShortcutRule = {
  actionId: ShortcutActionId
  accelerator: string
  scope: ShortcutScope
  when?: ShortcutWhen
  source: ShortcutRuleSource
}

export type ShortcutRuleOverrides = {
  accelerator?: string
  scope?: ShortcutScope
  when?: ShortcutWhen
}

export type ShortcutOverrides = Partial<Record<ShortcutActionId, ShortcutRuleOverrides>>

export type ShortcutRulePatch = {
  accelerator?: string
  scope?: ShortcutScope
  when?: ShortcutWhen | null
}

export type ShortcutRuleImport = {
  command: ShortcutActionId
  key: string
  scope: ShortcutScope
  when?: ShortcutWhen
}

export type ShortcutProfile = {
  rules: Record<ShortcutActionId, ShortcutRule>
}

export type ShortcutBindings = Record<ShortcutActionId, string>

export type ShortcutUpdateResult =
  | { ok: true }
  | {
      ok: false
      reason: string
      conflictWith?: ShortcutActionId
    }

export const SHORTCUT_WHEN_PRESETS: readonly ShortcutWhenPreset[] = [
  {
    id: 'window_focused',
    label: 'Window focused',
    when: 'windowFocus && !shortcutCapture'
  },
  {
    id: 'window_except_markdown',
    label: 'Window focused except Markdown editor',
    when: 'windowFocus && !shortcutCapture && !markdownEditorFocus'
  },
  {
    id: 'markdown_editor_only',
    label: 'Markdown editor only',
    when: 'windowFocus && !shortcutCapture && markdownEditorFocus'
  }
] as const

export const SHORTCUT_WHEN_PRESETS_BY_ID: Record<ShortcutWhenPresetId, ShortcutWhenPreset> =
  SHORTCUT_WHEN_PRESETS.reduce<Record<ShortcutWhenPresetId, ShortcutWhenPreset>>(
    (accumulator, preset) => {
      accumulator[preset.id] = preset
      return accumulator
    },
    {} as Record<ShortcutWhenPresetId, ShortcutWhenPreset>
  )

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: 'toggle_sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the app sidebar.',
    defaultAccelerator: 'CommandOrControl+B',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_except_markdown.when,
    whenPresets: ['window_focused', 'window_except_markdown', 'markdown_editor_only']
  },
  {
    id: 'toggle_bottom_panel',
    label: 'Toggle Bottom Panel',
    description: 'Show or hide the bottom panel.',
    defaultAccelerator: 'CommandOrControl+J',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'open_settings',
    label: 'Open Settings',
    description: 'Open the settings page.',
    defaultAccelerator: 'CommandOrControl+,',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'open_folder',
    label: 'Open Folder',
    description: 'Open a folder to use as your notes vault.',
    defaultAccelerator: 'CommandOrControl+O',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'create_note',
    label: 'Create Note',
    description: 'Create a new note in the selected notes folder.',
    defaultAccelerator: 'CommandOrControl+N',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'close_tab',
    label: 'Close Tab',
    description: 'Close the currently active tab.',
    defaultAccelerator: 'CommandOrControl+W',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'next_tab',
    label: 'Next Tab',
    description: 'Switch to the next tab.',
    defaultAccelerator: 'Control+Tab',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'prev_tab',
    label: 'Previous Tab',
    description: 'Switch to the previous tab.',
    defaultAccelerator: 'Control+Shift+Tab',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'reopen_closed_tab',
    label: 'Reopen Closed Tab',
    description: 'Reopen the most recently closed tab.',
    defaultAccelerator: 'CommandOrControl+Shift+T',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'split_pane_right',
    label: 'Split Right',
    description: 'Split the focused pane to the right.',
    defaultAccelerator: 'CommandOrControl+\\',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'split_pane_down',
    label: 'Split Down',
    description: 'Split the focused pane downward.',
    defaultAccelerator: 'CommandOrControl+Shift+\\',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'zoom_in',
    label: 'Zoom In',
    description: 'Increase the app zoom level.',
    defaultAccelerator: 'CommandOrControl+=',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'zoom_out',
    label: 'Zoom Out',
    description: 'Decrease the app zoom level.',
    defaultAccelerator: 'CommandOrControl+Minus',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'zoom_reset',
    label: 'Reset Zoom',
    description: 'Reset the app zoom level.',
    defaultAccelerator: 'CommandOrControl+0',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'show_main_window',
    label: 'Show Main Window',
    description: 'Bring the main app window to the foreground.',
    defaultAccelerator: 'CommandOrControl+Shift+Space',
    allowedScopes: ['window', 'global'],
    defaultScope: 'global',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'toggle_ghost_mode',
    label: 'Toggle Ghost Mode',
    description: 'Make the app invisible to screen recording, semi-transparent, and always on top.',
    defaultAccelerator: 'CommandOrControl+Shift+G',
    allowedScopes: ['window', 'global'],
    defaultScope: 'global',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'new_window',
    label: 'New Window',
    description: 'Open a new, independent app window.',
    defaultAccelerator: 'CommandOrControl+Shift+N',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Open the search palette to find notes by title or content.',
    defaultAccelerator: 'CommandOrControl+K',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'new_terminal',
    label: 'New Terminal',
    description: 'Create a new terminal session in the bottom panel.',
    defaultAccelerator: 'CommandOrControl+Alt+T',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'focus_terminal',
    label: 'Focus Terminal',
    description: 'Show the bottom panel and focus the active terminal session.',
    defaultAccelerator: 'CommandOrControl+Alt+J',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'kill_terminal',
    label: 'Kill Terminal',
    description: 'Terminate the currently focused terminal session.',
    defaultAccelerator: 'CommandOrControl+Alt+K',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'clear_terminal',
    label: 'Clear Terminal',
    description: 'Clear the output of the focused terminal session.',
    defaultAccelerator: 'CommandOrControl+Alt+L',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'split_terminal',
    label: 'Split Terminal',
    description: 'Split the focused terminal to the right.',
    defaultAccelerator: 'CommandOrControl+Alt+\\',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'split_terminal_right',
    label: 'Split Terminal Right',
    description: 'Split the focused terminal to the right.',
    defaultAccelerator: 'CommandOrControl+Alt+\\',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  },
  {
    id: 'split_terminal_down',
    label: 'Split Terminal Down',
    description: 'Split the focused terminal downward.',
    defaultAccelerator: 'CommandOrControl+Alt+Shift+\\',
    allowedScopes: ['window'],
    defaultScope: 'window',
    defaultWhen: SHORTCUT_WHEN_PRESETS_BY_ID.window_focused.when,
    whenPresets: ['window_focused']
  }
] as const

export const SHORTCUT_ACTION_IDS = SHORTCUT_DEFINITIONS.map(
  (definition) => definition.id
) as ShortcutActionId[]

export const SHORTCUT_DEFINITIONS_BY_ID = SHORTCUT_DEFINITIONS.reduce<
  Record<ShortcutActionId, ShortcutDefinition>
>(
  (accumulator, definition) => {
    accumulator[definition.id] = definition
    return accumulator
  },
  {} as Record<ShortcutActionId, ShortcutDefinition>
)

export const SHORTCUT_IPC_CHANNELS = {
  list: 'shortcuts:list',
  update: 'shortcuts:update',
  reset: 'shortcuts:reset',
  resetAll: 'shortcuts:reset-all',
  replaceAll: 'shortcuts:replace-all',
  execute: 'shortcuts:execute',
  bindingsChanged: 'shortcuts:bindings-changed',
  globalAction: 'shortcuts:global-action'
} as const

export function isShortcutActionId(value: string): value is ShortcutActionId {
  return SHORTCUT_ACTION_IDS.includes(value as ShortcutActionId)
}

export function normalizeShortcutWhen(
  when: ShortcutWhen | null | undefined
): ShortcutWhen | undefined {
  if (typeof when !== 'string') return undefined
  const trimmed = when.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getDefaultShortcutProfile(): ShortcutProfile {
  return {
    rules: SHORTCUT_DEFINITIONS.reduce<Record<ShortcutActionId, ShortcutRule>>(
      (accumulator, definition) => {
        accumulator[definition.id] = {
          actionId: definition.id,
          accelerator: definition.defaultAccelerator,
          scope: definition.defaultScope,
          when: normalizeShortcutWhen(definition.defaultWhen),
          source: 'system'
        }

        return accumulator
      },
      {} as Record<ShortcutActionId, ShortcutRule>
    )
  }
}

export function getDefaultShortcutBindings(): ShortcutBindings {
  const profile = getDefaultShortcutProfile()
  return SHORTCUT_ACTION_IDS.reduce<ShortcutBindings>(
    (bindings, actionId) => {
      bindings[actionId] = profile.rules[actionId].accelerator
      return bindings
    },
    {
      toggle_sidebar: 'CommandOrControl+B',
      toggle_bottom_panel: 'CommandOrControl+J',
      open_settings: 'CommandOrControl+,',
      open_folder: 'CommandOrControl+O',
      create_note: 'CommandOrControl+N',
      close_tab: 'CommandOrControl+W',
      next_tab: 'Control+Tab',
      prev_tab: 'Control+Shift+Tab',
      reopen_closed_tab: 'CommandOrControl+Shift+T',
      split_pane_right: 'CommandOrControl+\\',
      split_pane_down: 'CommandOrControl+Shift+\\',
      zoom_in: 'CommandOrControl+=',
      zoom_out: 'CommandOrControl+Minus',
      zoom_reset: 'CommandOrControl+0',
      show_main_window: 'CommandOrControl+Shift+Space',
      toggle_ghost_mode: 'CommandOrControl+Shift+G',
      new_window: 'CommandOrControl+Shift+N',
      search: 'CommandOrControl+K',
      new_terminal: 'CommandOrControl+Alt+T',
      focus_terminal: 'CommandOrControl+Alt+J',
      kill_terminal: 'CommandOrControl+Alt+K',
      clear_terminal: 'CommandOrControl+Alt+L',
      split_terminal: 'CommandOrControl+Alt+\\',
      split_terminal_right: 'CommandOrControl+Alt+\\',
      split_terminal_down: 'CommandOrControl+Alt+Shift+\\'
    }
  )
}
