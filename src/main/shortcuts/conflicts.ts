import {
  SHORTCUT_DEFINITIONS_BY_ID,
  type ShortcutActionId,
  type ShortcutBindings
} from '../../shared/shortcuts'
import { acceleratorToSignature, normalizeAccelerator } from './normalize'

type ShortcutValidationResult =
  | { ok: true }
  | {
      ok: false
      actionId: ShortcutActionId
      reason: string
      conflictWith?: ShortcutActionId
    }

const RESERVED_ACCELERATORS = ['CommandOrControl+R', 'F5', 'CommandOrControl+Shift+I'] as const

const RESERVED_SIGNATURES = new Set(
  RESERVED_ACCELERATORS.map((accelerator) => acceleratorToSignature(accelerator)).filter(
    (signature): signature is string => typeof signature === 'string'
  )
)

export function validateShortcutBindings(bindings: ShortcutBindings): ShortcutValidationResult {
  const seenSignatures = new Map<string, ShortcutActionId>()

  for (const actionId of Object.keys(SHORTCUT_DEFINITIONS_BY_ID) as ShortcutActionId[]) {
    const accelerator = bindings[actionId]
    const normalizedAccelerator = normalizeAccelerator(accelerator)

    if (!normalizedAccelerator) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut for "${SHORTCUT_DEFINITIONS_BY_ID[actionId].label}" is invalid.`
      }
    }

    const signature = acceleratorToSignature(normalizedAccelerator)

    if (!signature) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut for "${SHORTCUT_DEFINITIONS_BY_ID[actionId].label}" is invalid.`
      }
    }

    if (RESERVED_SIGNATURES.has(signature)) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut "${normalizedAccelerator}" is reserved by the app.`
      }
    }

    const conflictWith = seenSignatures.get(signature)

    if (conflictWith) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut conflicts with "${SHORTCUT_DEFINITIONS_BY_ID[conflictWith].label}".`,
        conflictWith
      }
    }

    seenSignatures.set(signature, actionId)
  }

  return { ok: true }
}
