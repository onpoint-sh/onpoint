import { useSyncExternalStore } from 'react'

export type IconThemeAdapter = {
  getFileIcon: (filename: string) => string
  getFolderIcon: (name: string, isOpen: boolean) => string
}

export type IconThemeId = 'material' | 'vscode-icons' | 'jetbrains'

/**
 * Creates an adapter from generated theme data.
 */
export function createAdapter(theme: {
  svgs: string[]
  fileExtensions: Record<string, number>
  fileNames: Record<string, number>
  folderNames: Record<string, number>
  folderNamesExpanded: Record<string, number>
  defaultFileIcon: number
  defaultFolderIcon: number
  defaultFolderOpenIcon: number
}): IconThemeAdapter {
  return {
    getFileIcon(filename: string): string {
      const lower = filename.toLowerCase()
      const baseName = lower.split('/').pop() ?? lower

      // check exact filename match first
      const byName = theme.fileNames[baseName]
      if (byName !== undefined) return theme.svgs[byName]

      // check file extension (try longest match first: .d.ts before .ts)
      const dotIdx = baseName.indexOf('.')
      if (dotIdx !== -1) {
        const fullExt = baseName.slice(dotIdx + 1)
        const byFullExt = theme.fileExtensions[fullExt]
        if (byFullExt !== undefined) return theme.svgs[byFullExt]

        // try last extension only
        const lastDot = baseName.lastIndexOf('.')
        if (lastDot !== dotIdx) {
          const shortExt = baseName.slice(lastDot + 1)
          const byShortExt = theme.fileExtensions[shortExt]
          if (byShortExt !== undefined) return theme.svgs[byShortExt]
        }
      }

      return theme.svgs[theme.defaultFileIcon]
    },

    getFolderIcon(name: string, isOpen: boolean): string {
      const lower = name.toLowerCase()
      if (isOpen) {
        const byName = theme.folderNamesExpanded[lower]
        if (byName !== undefined) return theme.svgs[byName]
        return theme.svgs[theme.defaultFolderOpenIcon]
      }
      const byName = theme.folderNames[lower]
      if (byName !== undefined) return theme.svgs[byName]
      return theme.svgs[theme.defaultFolderIcon]
    }
  }
}

// ── lazy-loading with external store for React ───────────────────────

const cache = new Map<IconThemeId, IconThemeAdapter>()
const listeners = new Set<() => void>()
let snapshotVersion = 0

function notify(): void {
  snapshotVersion++
  for (const cb of listeners) cb()
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot(): number {
  return snapshotVersion
}

export async function loadIconTheme(id: IconThemeId): Promise<IconThemeAdapter> {
  const cached = cache.get(id)
  if (cached) return cached

  let mod: {
    svgs: string[]
    fileExtensions: Record<string, number>
    fileNames: Record<string, number>
    folderNames: Record<string, number>
    folderNamesExpanded: Record<string, number>
    defaultFileIcon: number
    defaultFolderIcon: number
    defaultFolderOpenIcon: number
  }

  switch (id) {
    case 'material':
      mod = await import('./themes/material')
      break
    case 'vscode-icons':
      mod = await import('./themes/vscode-icons')
      break
    case 'jetbrains':
      mod = await import('./themes/jetbrains')
      break
  }

  const adapter = createAdapter(mod)
  cache.set(id, adapter)
  notify()
  return adapter
}

export function getLoadedIconTheme(id: IconThemeId): IconThemeAdapter | undefined {
  return cache.get(id)
}

/**
 * React hook that returns the loaded icon theme adapter.
 * Returns undefined until the theme finishes loading.
 */
export function useIconThemeAdapter(id: IconThemeId): IconThemeAdapter | undefined {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return cache.get(id)
}
