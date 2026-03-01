import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ICON_THEME_ID, getIconThemeById, type IconThemeId } from '@onpoint/icon-themes'

type PersistedIconThemeState = {
  iconThemeId: IconThemeId
}

export type IconThemeStoreState = PersistedIconThemeState & {
  setIconTheme: (id: IconThemeId) => void
}

export const useIconThemeStore = create<IconThemeStoreState>()(
  persist(
    (set) => ({
      iconThemeId: DEFAULT_ICON_THEME_ID,
      setIconTheme: (id) => {
        set({ iconThemeId: id })
      }
    }),
    {
      name: 'onpoint.icon-theme.v1',
      partialize: (state): PersistedIconThemeState => ({
        iconThemeId: state.iconThemeId
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedIconThemeState>

        const iconThemeId =
          typeof persisted.iconThemeId === 'string' && getIconThemeById(persisted.iconThemeId)
            ? (persisted.iconThemeId as IconThemeId)
            : currentState.iconThemeId

        return {
          ...currentState,
          iconThemeId
        }
      }
    }
  )
)
