import { useEffect, useMemo } from 'react'
import { acceleratorToSignature, eventToSignature } from '../../../shared/shortcut-accelerator'
import {
  SHORTCUT_DEFINITIONS_BY_ID,
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
  type ShortcutBindings
} from '../../../shared/shortcuts'
import { isEditableTarget, isShortcutCaptureTarget } from './is-editable-target'

type UseWindowShortcutsOptions = {
  bindings: ShortcutBindings
  onAction: (actionId: ShortcutActionId) => void
}

function useWindowShortcuts({ bindings, onAction }: UseWindowShortcutsOptions): void {
  const platform = window.windowControls.platform

  const signatureToActionMap = useMemo(() => {
    const map = new Map<string, ShortcutActionId>()

    for (const definition of SHORTCUT_DEFINITIONS) {
      if (definition.scope !== 'window') continue
      const signature = acceleratorToSignature(bindings[definition.id], platform)
      if (!signature) continue
      map.set(signature, definition.id)
    }

    return map
  }, [bindings, platform])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return
      if (isShortcutCaptureTarget(event.target)) return

      const eventSignature = eventToSignature(event, platform)
      if (!eventSignature) return

      const actionId = signatureToActionMap.get(eventSignature)
      if (!actionId) return

      const definition = SHORTCUT_DEFINITIONS_BY_ID[actionId]

      if (!definition.allowInEditable && isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      onAction(actionId)
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onAction, platform, signatureToActionMap])
}

export { useWindowShortcuts }
export type { UseWindowShortcutsOptions }
