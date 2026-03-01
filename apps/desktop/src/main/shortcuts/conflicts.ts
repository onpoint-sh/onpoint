import {
  SHORTCUT_DEFINITIONS_BY_ID,
  SHORTCUT_ACTION_IDS,
  type ShortcutActionId,
  type ShortcutProfile
} from '@onpoint/shared/shortcuts'
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

export function validateShortcutProfile(profile: ShortcutProfile): ShortcutValidationResult {
  const seenGlobalSignatures = new Map<string, ShortcutActionId>()

  for (const actionId of SHORTCUT_ACTION_IDS) {
    const definition = SHORTCUT_DEFINITIONS_BY_ID[actionId]
    const rule = profile.rules[actionId]

    if (!rule) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut for "${definition.label}" is missing.`
      }
    }

    const normalizedAccelerator = normalizeAccelerator(rule.accelerator)

    if (!normalizedAccelerator) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut for "${definition.label}" is invalid.`
      }
    }

    const signature = acceleratorToSignature(normalizedAccelerator)

    if (!signature) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut for "${definition.label}" is invalid.`
      }
    }

    if (RESERVED_SIGNATURES.has(signature)) {
      return {
        ok: false,
        actionId,
        reason: `Shortcut "${normalizedAccelerator}" is reserved by the app.`
      }
    }

    if (rule.scope !== 'global') continue

    const conflictWith = seenGlobalSignatures.get(signature)

    if (conflictWith) {
      return {
        ok: false,
        actionId,
        reason: `Global shortcut conflicts with "${SHORTCUT_DEFINITIONS_BY_ID[conflictWith].label}".`,
        conflictWith
      }
    }

    seenGlobalSignatures.set(signature, actionId)
  }

  return { ok: true }
}
