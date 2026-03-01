import { describe, expect, it } from 'vitest'
import { getDefaultShortcutProfile } from '@onpoint/shared/shortcuts'
import { validateShortcutProfile } from './conflicts'

describe('validateShortcutProfile', () => {
  it('allows window shortcut collisions', () => {
    const profile = getDefaultShortcutProfile()

    profile.rules.open_settings.accelerator = profile.rules.toggle_sidebar.accelerator
    profile.rules.open_settings.scope = 'window'
    profile.rules.toggle_sidebar.scope = 'window'

    const result = validateShortcutProfile(profile)
    expect(result.ok).toBe(true)
  })

  it('rejects global shortcut collisions', () => {
    const profile = getDefaultShortcutProfile()

    profile.rules.show_main_window.accelerator = 'CommandOrControl+Shift+G'
    profile.rules.show_main_window.scope = 'global'
    profile.rules.toggle_ghost_mode.accelerator = 'CommandOrControl+Shift+G'
    profile.rules.toggle_ghost_mode.scope = 'global'

    const result = validateShortcutProfile(profile)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflictWith).toBe('show_main_window')
  })

  it('rejects reserved shortcuts', () => {
    const profile = getDefaultShortcutProfile()

    profile.rules.toggle_sidebar.accelerator = 'F5'

    const result = validateShortcutProfile(profile)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('reserved')
  })
})
