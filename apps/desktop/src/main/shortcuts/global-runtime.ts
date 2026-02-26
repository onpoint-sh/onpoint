import { globalShortcut } from 'electron'
import {
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutDefinition
} from '@onpoint/shared/shortcuts'

type ApplyGlobalBindingsResult =
  | { ok: true }
  | {
      ok: false
      reason: string
    }

type GlobalShortcutRuntimeOptions = {
  onAction: (actionId: ShortcutActionId) => void
}

class GlobalShortcutRuntime {
  private readonly onAction: (actionId: ShortcutActionId) => void
  private registeredBindings = new Map<ShortcutActionId, string>()

  constructor(options: GlobalShortcutRuntimeOptions) {
    this.onAction = options.onAction
  }

  apply(
    bindings: ShortcutBindings,
    globalDefinitions: readonly ShortcutDefinition[]
  ): ApplyGlobalBindingsResult {
    const nextBindings = new Map<ShortcutActionId, string>()

    for (const definition of globalDefinitions) {
      nextBindings.set(definition.id, bindings[definition.id])
    }

    const previousBindings = new Map(this.registeredBindings)

    this.unregisterAll()

    for (const [actionId, accelerator] of nextBindings.entries()) {
      const didRegister = globalShortcut.register(accelerator, () => {
        this.onAction(actionId)
      })

      if (!didRegister) {
        this.unregisterAll()
        this.restore(previousBindings)
        return {
          ok: false,
          reason: `Unable to register global shortcut "${accelerator}". It may be in use by another app.`
        }
      }
    }

    this.registeredBindings = nextBindings
    return { ok: true }
  }

  dispose(): void {
    this.unregisterAll()
  }

  private restore(bindings: Map<ShortcutActionId, string>): void {
    for (const [actionId, accelerator] of bindings.entries()) {
      const didRegister = globalShortcut.register(accelerator, () => {
        this.onAction(actionId)
      })

      if (!didRegister) continue
    }

    this.registeredBindings = bindings
  }

  private unregisterAll(): void {
    for (const accelerator of this.registeredBindings.values()) {
      globalShortcut.unregister(accelerator)
    }

    this.registeredBindings.clear()
  }
}

export { GlobalShortcutRuntime }
export type { ApplyGlobalBindingsResult }
