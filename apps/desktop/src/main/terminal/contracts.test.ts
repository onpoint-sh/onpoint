import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_SETTINGS,
  TERMINAL_EVENT_CHANNELS,
  TERMINAL_IPC_CHANNELS
} from '@onpoint/shared/terminal'
import { getDefaultShortcutProfile } from '@onpoint/shared/shortcuts'

describe('terminal shared contracts', () => {
  it('defines stable IPC and event channels', () => {
    expect(TERMINAL_IPC_CHANNELS.createSession).toBe('terminal:create-session')
    expect(TERMINAL_IPC_CHANNELS.listSessions).toBe('terminal:list-sessions')
    expect(TERMINAL_IPC_CHANNELS.updateSettings).toBe('terminal:update-settings')

    expect(TERMINAL_EVENT_CHANNELS.data).toBe('terminal:event-data')
    expect(TERMINAL_EVENT_CHANNELS.sessionChanged).toBe('terminal:event-session-changed')
  })

  it('exposes sensible terminal defaults', () => {
    expect(DEFAULT_TERMINAL_SETTINGS.fontSize).toBeGreaterThanOrEqual(10)
    expect(DEFAULT_TERMINAL_SETTINGS.scrollback).toBeGreaterThanOrEqual(1000)
    expect(['auto', 'canvas', 'dom']).toContain(DEFAULT_TERMINAL_SETTINGS.rendererType)
    expect(['none', 'sound', 'visual']).toContain(DEFAULT_TERMINAL_SETTINGS.bellStyle)
  })

  it('adds terminal shortcut defaults to the profile', () => {
    const profile = getDefaultShortcutProfile()

    expect(profile.rules.new_terminal.accelerator).toBe('CommandOrControl+Alt+T')
    expect(profile.rules.focus_terminal.accelerator).toBe('CommandOrControl+Alt+J')
    expect(profile.rules.kill_terminal.accelerator).toBe('CommandOrControl+Alt+K')
    expect(profile.rules.clear_terminal.accelerator).toBe('CommandOrControl+Alt+L')
    expect(profile.rules.split_terminal.accelerator).toBe('CommandOrControl+Alt+\\')
    expect(profile.rules.split_terminal_right.accelerator).toBe('CommandOrControl+Alt+\\')
    expect(profile.rules.split_terminal_down.accelerator).toBe('CommandOrControl+Alt+Shift+\\')
  })
})
