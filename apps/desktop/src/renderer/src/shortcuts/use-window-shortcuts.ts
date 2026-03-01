import { useEffect, useMemo } from 'react'
import { acceleratorToSignature, eventToSignature } from '@onpoint/shared/shortcut-accelerator'
import {
  SHORTCUT_ACTION_IDS,
  type ShortcutActionId,
  type ShortcutProfile,
  type ShortcutRule
} from '@onpoint/shared/shortcuts'
import { buildShortcutContext } from './context-keys'
import { evaluateWhenExpression } from './when-expression'

type UseWindowShortcutsOptions = {
  profile: ShortcutProfile
  onAction: (actionId: ShortcutActionId) => void
  searchPaletteVisible: boolean
}

type ShortcutCandidate = {
  rule: ShortcutRule
  definitionIndex: number
}

function useWindowShortcuts({
  profile,
  onAction,
  searchPaletteVisible
}: UseWindowShortcutsOptions): void {
  const platform = window.windowControls.platform

  const signatureToCandidatesMap = useMemo(() => {
    const map = new Map<string, ShortcutCandidate[]>()

    for (const [definitionIndex, actionId] of SHORTCUT_ACTION_IDS.entries()) {
      const rule = profile.rules[actionId]
      if (!rule || rule.scope !== 'window') continue

      const signature = acceleratorToSignature(rule.accelerator, platform)
      if (!signature) continue

      const existingCandidates = map.get(signature) ?? []
      existingCandidates.push({
        rule,
        definitionIndex
      })
      map.set(signature, existingCandidates)
    }

    for (const [signature, candidates] of map.entries()) {
      candidates.sort((a, b) => {
        if (a.rule.source !== b.rule.source) {
          return a.rule.source === 'user' ? -1 : 1
        }

        return b.definitionIndex - a.definitionIndex
      })
      map.set(signature, candidates)
    }

    return map
  }, [platform, profile])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return

      const eventSignature = eventToSignature(event, platform)
      if (!eventSignature) return

      const candidates = signatureToCandidatesMap.get(eventSignature)
      if (!candidates || candidates.length === 0) return

      const context = buildShortcutContext(event.target, {
        searchPaletteVisible
      })

      if (context.shortcutCapture) {
        return
      }

      for (const candidate of candidates) {
        if (!evaluateWhenExpression(candidate.rule.when, context)) {
          continue
        }

        event.preventDefault()
        onAction(candidate.rule.actionId)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onAction, platform, searchPaletteVisible, signatureToCandidatesMap])
}

export { useWindowShortcuts }
export type { UseWindowShortcutsOptions }
