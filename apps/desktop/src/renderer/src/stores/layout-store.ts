import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { WINDOW_ID } from '@/lib/detached-window'

// Migrate old unkeyed localStorage to keyed format for the "main" window
if (WINDOW_ID === 'main') {
  const keyedKey = 'onpoint.layout.v1.main'
  const unkeyedKey = 'onpoint.layout.v1'
  if (!localStorage.getItem(keyedKey) && localStorage.getItem(unkeyedKey)) {
    localStorage.setItem(keyedKey, localStorage.getItem(unkeyedKey)!)
    localStorage.removeItem(unkeyedKey)
  }
}

export const SIDEBAR_DEFAULT_WIDTH = 280
export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 480

function clampSidebarWidth(width: number): number {
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH)
}

function normalizeSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH
  return clampSidebarWidth(width)
}

type PersistedLayoutState = {
  isSidebarOpen: boolean
  sidebarWidth: number
}

export type LayoutStoreState = {
  isSidebarOpen: boolean
  sidebarWidth: number
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
}

export const useLayoutStore = create<LayoutStoreState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }))
      },
      setSidebarOpen: (open) => {
        set({ isSidebarOpen: open })
      },
      setSidebarWidth: (width) => {
        set({ sidebarWidth: normalizeSidebarWidth(width) })
      }
    }),
    {
      name: `onpoint.layout.v1.${WINDOW_ID}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedLayoutState => ({
        isSidebarOpen: state.isSidebarOpen,
        sidebarWidth: state.sidebarWidth
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedLayoutState>

        return {
          ...currentState,
          isSidebarOpen:
            typeof persisted.isSidebarOpen === 'boolean'
              ? persisted.isSidebarOpen
              : currentState.isSidebarOpen,
          sidebarWidth: normalizeSidebarWidth(
            typeof persisted.sidebarWidth === 'number'
              ? persisted.sidebarWidth
              : currentState.sidebarWidth
          )
        }
      }
    }
  )
)
