import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { WINDOW_ID } from '@/lib/detached-window'

export type AppViewMode = 'editor' | 'agents'

type PersistedViewModeState = {
  viewMode: AppViewMode
}

type ViewModeStoreState = {
  viewMode: AppViewMode
  setViewMode: (viewMode: AppViewMode) => void
}

export const useViewModeStore = create<ViewModeStoreState>()(
  persist(
    (set) => ({
      viewMode: 'editor',
      setViewMode: (viewMode) => set({ viewMode })
    }),
    {
      name: `onpoint.view-mode.v1.${WINDOW_ID}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedViewModeState => ({
        viewMode: state.viewMode
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedViewModeState>
        return {
          ...currentState,
          viewMode: persisted.viewMode === 'agents' ? 'agents' : 'editor'
        }
      }
    }
  )
)
