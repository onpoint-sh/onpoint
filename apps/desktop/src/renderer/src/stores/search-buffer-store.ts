import { create } from 'zustand'
import type { OpenBufferSnapshot } from '@onpoint/shared/notes'

type SearchBufferStoreState = {
  snapshots: Record<string, OpenBufferSnapshot>
  retainCounts: Record<string, number>
  retainPath: (relativePath: string) => void
  releasePath: (relativePath: string) => void
  upsertSnapshot: (snapshot: OpenBufferSnapshot) => void
  markSaved: (relativePath: string, content: string, mtimeMs?: number) => void
}

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

export const useSearchBufferStore = create<SearchBufferStoreState>()((set, get) => ({
  snapshots: {},
  retainCounts: {},

  retainPath: (relativePath: string) => {
    const normalizedPath = normalizePath(relativePath)
    if (!normalizedPath) return

    set((state) => ({
      retainCounts: {
        ...state.retainCounts,
        [normalizedPath]: (state.retainCounts[normalizedPath] ?? 0) + 1
      }
    }))
  },

  releasePath: (relativePath: string) => {
    const normalizedPath = normalizePath(relativePath)
    if (!normalizedPath) return

    set((state) => {
      const currentCount = state.retainCounts[normalizedPath] ?? 0
      if (currentCount <= 1) {
        const nextRetainCounts = { ...state.retainCounts }
        delete nextRetainCounts[normalizedPath]

        const nextSnapshots = { ...state.snapshots }
        delete nextSnapshots[normalizedPath]

        return {
          retainCounts: nextRetainCounts,
          snapshots: nextSnapshots
        }
      }

      return {
        retainCounts: {
          ...state.retainCounts,
          [normalizedPath]: currentCount - 1
        }
      }
    })
  },

  upsertSnapshot: (snapshot: OpenBufferSnapshot) => {
    const normalizedPath = normalizePath(snapshot.relativePath)
    if (!normalizedPath) return

    set((state) => ({
      snapshots: {
        ...state.snapshots,
        [normalizedPath]: {
          ...state.snapshots[normalizedPath],
          ...snapshot,
          relativePath: normalizedPath
        }
      }
    }))
  },

  markSaved: (relativePath: string, content: string, mtimeMs?: number) => {
    const normalizedPath = normalizePath(relativePath)
    if (!normalizedPath) return

    const previous = get().snapshots[normalizedPath]
    if (!previous) return

    set((state) => ({
      snapshots: {
        ...state.snapshots,
        [normalizedPath]: {
          ...previous,
          content,
          isDirty: false,
          mtimeMs: mtimeMs ?? previous.mtimeMs
        }
      }
    }))
  }
}))
