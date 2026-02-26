import { create } from 'zustand'
import { type ShortcutActionId } from '../../../shared/shortcuts'

type ErrorByAction = Partial<Record<ShortcutActionId, string>>

type ShortcutSettingsStoreState = {
  editingActionId: ShortcutActionId | null
  pendingActionId: ShortcutActionId | 'all' | null
  errorByAction: ErrorByAction
  setEditingActionId: (actionId: ShortcutActionId | null) => void
  setPendingActionId: (actionId: ShortcutActionId | 'all' | null) => void
  setError: (actionId: ShortcutActionId, message: string | null) => void
  clearErrors: () => void
}

const useShortcutSettingsStore = create<ShortcutSettingsStoreState>((set) => ({
  editingActionId: null,
  pendingActionId: null,
  errorByAction: {},
  setEditingActionId: (actionId) => {
    set({ editingActionId: actionId })
  },
  setPendingActionId: (actionId) => {
    set({ pendingActionId: actionId })
  },
  setError: (actionId, message) => {
    set((state) => {
      const nextErrorByAction = { ...state.errorByAction }

      if (!message) {
        delete nextErrorByAction[actionId]
      } else {
        nextErrorByAction[actionId] = message
      }

      return {
        errorByAction: nextErrorByAction
      }
    })
  },
  clearErrors: () => {
    set({ errorByAction: {} })
  }
}))

export { useShortcutSettingsStore }
