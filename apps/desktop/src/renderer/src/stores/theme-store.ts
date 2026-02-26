import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_THEME_PREFERENCES,
  getThemeById,
  type ThemeMode,
  type ThemePreferences
} from '@onpoint/themes'

type PersistedThemeState = ThemePreferences

export type ThemeStoreState = ThemePreferences & {
  setMode: (mode: ThemeMode) => void
  setLightTheme: (themeId: string) => void
  setDarkTheme: (themeId: string) => void
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_THEME_PREFERENCES,
      setMode: (mode) => {
        set({ mode })
      },
      setLightTheme: (themeId) => {
        set({ lightThemeId: themeId })
      },
      setDarkTheme: (themeId) => {
        set({ darkThemeId: themeId })
      }
    }),
    {
      name: 'onpoint.theme.v1',
      partialize: (state): PersistedThemeState => ({
        mode: state.mode,
        lightThemeId: state.lightThemeId,
        darkThemeId: state.darkThemeId
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedThemeState>

        const validModes: ThemeMode[] = ['auto', 'light', 'dark']
        const mode = validModes.includes(persisted.mode as ThemeMode)
          ? (persisted.mode as ThemeMode)
          : currentState.mode

        const lightThemeId =
          typeof persisted.lightThemeId === 'string' && getThemeById(persisted.lightThemeId)
            ? persisted.lightThemeId
            : currentState.lightThemeId

        const darkThemeId =
          typeof persisted.darkThemeId === 'string' && getThemeById(persisted.darkThemeId)
            ? persisted.darkThemeId
            : currentState.darkThemeId

        return {
          ...currentState,
          mode,
          lightThemeId,
          darkThemeId
        }
      }
    }
  )
)
