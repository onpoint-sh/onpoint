import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { WINDOW_ID } from '@/lib/detached-window'

type OpenMap = { [id: string]: boolean }

type PersistedTreeState = {
  expandedFolders: OpenMap
}

export type TreeStateStoreState = {
  expandedFolders: OpenMap
  setExpandedFolders: (openState: OpenMap) => void
}

export const useTreeStateStore = create<TreeStateStoreState>()(
  persist(
    (set) => ({
      expandedFolders: {},
      setExpandedFolders: (openState) => {
        set({ expandedFolders: openState })
      }
    }),
    {
      name: `onpoint.tree-state.v1.${WINDOW_ID}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedTreeState => ({
        expandedFolders: state.expandedFolders
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedTreeState>

        return {
          ...currentState,
          expandedFolders:
            persisted.expandedFolders &&
            typeof persisted.expandedFolders === 'object' &&
            !Array.isArray(persisted.expandedFolders)
              ? persisted.expandedFolders
              : currentState.expandedFolders
        }
      }
    }
  )
)
