export type ShortcutScope = 'window' | 'global'

export type ShortcutActionId =
  | 'toggle_sidebar'
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

export type ShortcutDefinition = {
  id: ShortcutActionId
  label: string
  description: string
  scope: ShortcutScope
  defaultAccelerator: string
  allowInEditable?: boolean
}

export type ShortcutBindings = Record<ShortcutActionId, string>

export type ShortcutOverrides = Partial<Record<ShortcutActionId, string>>

export type ShortcutUpdateResult =
  | { ok: true }
  | {
      ok: false
      reason: string
      conflictWith?: ShortcutActionId
    }

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: 'toggle_sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the app sidebar.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+B'
  },
  {
    id: 'open_settings',
    label: 'Open Settings',
    description: 'Open the settings page.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+,',
    allowInEditable: true
  },
  {
    id: 'open_folder',
    label: 'Open Folder',
    description: 'Open a folder to use as your notes vault.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+O',
    allowInEditable: true
  },
  {
    id: 'create_note',
    label: 'Create Note',
    description: 'Create a new note in the selected notes folder.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+N',
    allowInEditable: true
  },
  {
    id: 'close_tab',
    label: 'Close Tab',
    description: 'Close the currently active tab.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+W',
    allowInEditable: true
  },
  {
    id: 'next_tab',
    label: 'Next Tab',
    description: 'Switch to the next tab.',
    scope: 'window',
    defaultAccelerator: 'Control+Tab',
    allowInEditable: true
  },
  {
    id: 'prev_tab',
    label: 'Previous Tab',
    description: 'Switch to the previous tab.',
    scope: 'window',
    defaultAccelerator: 'Control+Shift+Tab',
    allowInEditable: true
  },
  {
    id: 'reopen_closed_tab',
    label: 'Reopen Closed Tab',
    description: 'Reopen the most recently closed tab.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+Shift+T',
    allowInEditable: true
  },
  {
    id: 'split_pane_right',
    label: 'Split Right',
    description: 'Split the focused pane to the right.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+\\',
    allowInEditable: true
  },
  {
    id: 'split_pane_down',
    label: 'Split Down',
    description: 'Split the focused pane downward.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+Shift+\\',
    allowInEditable: true
  },
  {
    id: 'zoom_in',
    label: 'Zoom In',
    description: 'Increase the app zoom level.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+=',
    allowInEditable: true
  },
  {
    id: 'zoom_out',
    label: 'Zoom Out',
    description: 'Decrease the app zoom level.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+Minus',
    allowInEditable: true
  },
  {
    id: 'zoom_reset',
    label: 'Reset Zoom',
    description: 'Reset the app zoom level.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+0',
    allowInEditable: true
  },
  {
    id: 'show_main_window',
    label: 'Show Main Window',
    description: 'Bring the main app window to the foreground.',
    scope: 'global',
    defaultAccelerator: 'CommandOrControl+Shift+Space'
  },
  {
    id: 'toggle_ghost_mode',
    label: 'Toggle Ghost Mode',
    description: 'Make the app invisible to screen recording, semi-transparent, and always on top.',
    scope: 'global',
    defaultAccelerator: 'CommandOrControl+Shift+G'
  },
  {
    id: 'new_window',
    label: 'New Window',
    description: 'Open a new, independent app window.',
    scope: 'window',
    defaultAccelerator: 'CommandOrControl+Shift+N',
    allowInEditable: true
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
  bindingsChanged: 'shortcuts:bindings-changed',
  globalAction: 'shortcuts:global-action'
} as const

export function isShortcutActionId(value: string): value is ShortcutActionId {
  return SHORTCUT_ACTION_IDS.includes(value as ShortcutActionId)
}

export function getDefaultShortcutBindings(): ShortcutBindings {
  return SHORTCUT_DEFINITIONS.reduce<ShortcutBindings>(
    (bindings, definition) => {
      bindings[definition.id] = definition.defaultAccelerator
      return bindings
    },
    {
      toggle_sidebar: 'CommandOrControl+B',
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
      new_window: 'CommandOrControl+Shift+N'
    }
  )
}
