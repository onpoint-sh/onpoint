import { BrowserWindow } from 'electron'
import {
  SHORTCUT_IPC_CHANNELS,
  getDefaultShortcutBindings,
  isShortcutActionId,
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutOverrides,
  type ShortcutUpdateResult
} from '../../shared/shortcuts'
import { validateShortcutBindings } from './conflicts'
import { globalShortcutDefinitions } from './definitions'
import { GlobalShortcutRuntime } from './global-runtime'
import { registerShortcutsIpc } from './ipc'
import { normalizeAccelerator } from './normalize'
import { loadShortcutOverrides, saveShortcutOverrides } from './store'

type ShortcutServiceOptions = {
  getWindows: () => BrowserWindow[]
  onGlobalAction: (actionId: ShortcutActionId) => void
}

type ShortcutService = {
  initialize: () => Promise<void>
  list: () => ShortcutBindings
  update: (actionId: ShortcutActionId, accelerator: string) => Promise<ShortcutUpdateResult>
  reset: (actionId: ShortcutActionId) => Promise<void>
  resetAll: () => Promise<void>
  dispose: () => void
}

function buildBindings(
  defaultBindings: ShortcutBindings,
  overrides: ShortcutOverrides
): ShortcutBindings {
  return {
    ...defaultBindings,
    ...overrides
  }
}

function buildOverrides(
  defaultBindings: ShortcutBindings,
  bindings: ShortcutBindings
): ShortcutOverrides {
  const overrides: ShortcutOverrides = {}

  for (const actionId of Object.keys(defaultBindings) as ShortcutActionId[]) {
    const binding = bindings[actionId]
    const normalizedBinding = normalizeAccelerator(binding)
    if (!normalizedBinding) continue
    if (normalizedBinding === defaultBindings[actionId]) continue
    overrides[actionId] = normalizedBinding
  }

  return overrides
}

export function createShortcutService(options: ShortcutServiceOptions): ShortcutService {
  const defaultBindings = getDefaultShortcutBindings()

  let bindings = defaultBindings
  let overrides: ShortcutOverrides = {}
  let isDisposed = false
  let unregisterIpcHandlers: (() => void) | null = null

  const runtime = new GlobalShortcutRuntime({
    onAction: (actionId) => {
      options.onGlobalAction(actionId)
      emitGlobalAction(actionId)
    }
  })

  function list(): ShortcutBindings {
    return { ...bindings }
  }

  function emitBindingsChanged(): void {
    for (const window of options.getWindows()) {
      if (window.isDestroyed()) continue
      window.webContents.send(SHORTCUT_IPC_CHANNELS.bindingsChanged, list())
    }
  }

  function emitGlobalAction(actionId: ShortcutActionId): void {
    const focusedWindow = BrowserWindow.getFocusedWindow()

    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.webContents.send(SHORTCUT_IPC_CHANNELS.globalAction, actionId)
      return
    }

    const [primaryWindow] = options.getWindows()
    if (!primaryWindow || primaryWindow.isDestroyed()) return
    primaryWindow.webContents.send(SHORTCUT_IPC_CHANNELS.globalAction, actionId)
  }

  async function applyBindings(nextBindings: ShortcutBindings): Promise<ShortcutUpdateResult> {
    const validation = validateShortcutBindings(nextBindings)

    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
        conflictWith: validation.conflictWith
      }
    }

    const previousBindings = bindings
    const previousOverrides = overrides

    const applyGlobalsResult = runtime.apply(nextBindings, globalShortcutDefinitions)

    if (!applyGlobalsResult.ok) {
      return {
        ok: false,
        reason: applyGlobalsResult.reason
      }
    }

    const nextOverrides = buildOverrides(defaultBindings, nextBindings)

    bindings = nextBindings
    overrides = nextOverrides

    try {
      await saveShortcutOverrides(nextOverrides)
    } catch (error) {
      console.error('Failed to persist shortcut settings.', error)
      runtime.apply(previousBindings, globalShortcutDefinitions)
      bindings = previousBindings
      overrides = previousOverrides
      return {
        ok: false,
        reason: 'Failed to persist shortcuts. Please try again.'
      }
    }

    emitBindingsChanged()
    return { ok: true }
  }

  async function initialize(): Promise<void> {
    if (isDisposed) return

    unregisterIpcHandlers = registerShortcutsIpc({
      list,
      update,
      reset,
      resetAll
    })

    const loadedOverrides = await loadShortcutOverrides()
    const loadedBindings = buildBindings(defaultBindings, loadedOverrides)
    const applyResult = await applyBindings(loadedBindings)

    if (!applyResult.ok) {
      bindings = defaultBindings
      overrides = {}
      runtime.apply(defaultBindings, globalShortcutDefinitions)
      await saveShortcutOverrides({})
    }
  }

  async function update(
    actionId: ShortcutActionId,
    accelerator: string
  ): Promise<ShortcutUpdateResult> {
    if (!isShortcutActionId(actionId)) {
      return {
        ok: false,
        reason: 'Unknown shortcut action.'
      }
    }

    const normalizedAccelerator = normalizeAccelerator(accelerator)

    if (!normalizedAccelerator) {
      return {
        ok: false,
        reason: 'Shortcut is invalid. Use a key combination like CommandOrControl+B.'
      }
    }

    const nextBindings: ShortcutBindings = {
      ...bindings,
      [actionId]: normalizedAccelerator
    }

    return applyBindings(nextBindings)
  }

  async function reset(actionId: ShortcutActionId): Promise<void> {
    if (!isShortcutActionId(actionId)) {
      throw new Error('Unknown shortcut action.')
    }

    const nextBindings: ShortcutBindings = {
      ...bindings,
      [actionId]: defaultBindings[actionId]
    }

    const result = await applyBindings(nextBindings)

    if (!result.ok) {
      throw new Error(result.reason)
    }
  }

  async function resetAll(): Promise<void> {
    const result = await applyBindings(defaultBindings)

    if (!result.ok) {
      throw new Error(result.reason)
    }
  }

  function dispose(): void {
    if (isDisposed) return
    isDisposed = true
    runtime.dispose()
    unregisterIpcHandlers?.()
    unregisterIpcHandlers = null
  }

  return {
    initialize,
    list,
    update,
    reset,
    resetAll,
    dispose
  }
}

export type { ShortcutService }
