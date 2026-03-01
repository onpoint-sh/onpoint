import { create } from 'zustand'
import type { NoteSummary, NotesConfig } from '@onpoint/shared/notes'
import { usePanesStore } from './panes-store'

export type NotesStoreState = {
  config: NotesConfig
  notes: NoteSummary[]
  isLoading: boolean
  error: string | null
  hasInitialized: boolean
  initialize: () => Promise<void>
  pickVault: () => Promise<void>
  createNote: (parentRelativePath?: string) => Promise<string | null>
  renameNote: (relativePath: string, requestedTitle: string) => Promise<void>
  deleteNote: (relativePath: string) => Promise<void>
  deleteFolder: (relativePath: string) => Promise<void>
  archiveNote: (relativePath: string) => Promise<void>
  moveNote: (fromPath: string, toPath: string) => Promise<void>
  createFolder: (relativePath: string) => Promise<string | null>
  renameFolder: (fromPath: string, toPath: string) => Promise<void>
  refreshNotesList: () => Promise<void>
}

const DEFAULT_NOTES_CONFIG: NotesConfig = {
  vaultPath: null,
  lastOpenedRelativePath: null
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
  }

  return fallback
}

export const useNotesStore = create<NotesStoreState>()((set, get) => ({
  config: DEFAULT_NOTES_CONFIG,
  notes: [],
  isLoading: false,
  error: null,
  hasInitialized: false,

  initialize: async () => {
    set({ isLoading: true, error: null })

    try {
      const config = await window.notes.getConfig()

      if (!config.vaultPath) {
        set({
          config,
          notes: [],
          isLoading: false,
          error: null,
          hasInitialized: true
        })
        return
      }

      const notes = await window.notes.listNotes()

      set({
        config,
        notes,
        isLoading: false,
        error: null,
        hasInitialized: true
      })

      // Validate panes against actual notes
      const notePaths = new Set(notes.map((n) => n.relativePath))
      usePanesStore.getState().validatePanes(notePaths)

      // If no panes exist but we have a last-opened note, create a pane for it
      const panesState = usePanesStore.getState()
      if (panesState.layout === null && config.lastOpenedRelativePath) {
        const hasNote = notes.some((n) => n.relativePath === config.lastOpenedRelativePath)
        if (hasNote) {
          usePanesStore.getState().openTab(config.lastOpenedRelativePath!)
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to initialize notes.'),
        hasInitialized: true
      })
    }
  },

  pickVault: async () => {
    set({ isLoading: true, error: null })

    try {
      const selectedVault = await window.notes.pickVault()

      if (!selectedVault) {
        set({ isLoading: false })
        return
      }

      await get().initialize()
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to choose notes folder.')
      })
    }
  },

  createNote: async (parentRelativePath?: string) => {
    const { config } = get()
    if (!config.vaultPath) return null

    set({ isLoading: true, error: null })

    try {
      const note = await window.notes.createNote(undefined, parentRelativePath)
      const notes = await window.notes.listNotes()
      const config = await window.notes.getConfig()

      set({ config, notes, isLoading: false, error: null })

      // Open the new note in a tab in the focused pane
      usePanesStore.getState().openTab(note.relativePath)

      return note.relativePath
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to create file.')
      })
      return null
    }
  },

  renameNote: async (relativePath: string, requestedTitle: string) => {
    const trimmedTitle = requestedTitle.trim()

    if (trimmedTitle.length === 0) {
      return
    }

    const activeNote = get().notes.find((note) => note.relativePath === relativePath)
    if (activeNote?.title === trimmedTitle) {
      return
    }

    set({ isLoading: true, error: null })

    try {
      const renameResult = await window.notes.renameNote(relativePath, trimmedTitle)
      const notes = await window.notes.listNotes()
      const config = await window.notes.getConfig()

      set({ config, notes, isLoading: false, error: null })

      // Update tab paths across all panes
      usePanesStore.getState().updateTabPath(relativePath, renameResult.relativePath)
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to rename file.')
      })
    }
  },

  deleteNote: async (relativePath: string) => {
    set({ isLoading: true, error: null })

    try {
      await window.notes.deleteNote(relativePath)
      const notes = await window.notes.listNotes()
      const config = await window.notes.getConfig()

      set({ config, notes, isLoading: false, error: null })

      // Remove tabs showing this note from all panes
      usePanesStore.getState().removeTabsByPath(relativePath)
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to delete file.')
      })
    }
  },

  deleteFolder: async (relativePath: string) => {
    set({ isLoading: true, error: null })
    const folderPrefix = `${relativePath}/`
    const notePathsToClose = get()
      .notes.filter((note) => note.relativePath.startsWith(folderPrefix))
      .map((note) => note.relativePath)

    try {
      await window.notes.deleteFolder(relativePath)
      const notes = await window.notes.listNotes()
      const config = await window.notes.getConfig()

      set({ config, notes, isLoading: false, error: null })

      for (const notePath of notePathsToClose) {
        usePanesStore.getState().removeTabsByPath(notePath)
      }
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to delete folder.')
      })
    }
  },

  archiveNote: async (relativePath: string) => {
    set({ isLoading: true, error: null })

    try {
      await window.notes.archiveNote(relativePath)
      const notes = await window.notes.listNotes()
      const config = await window.notes.getConfig()

      set({ config, notes, isLoading: false, error: null })

      // Remove tabs showing this note from all panes
      usePanesStore.getState().removeTabsByPath(relativePath)
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to archive file.')
      })
    }
  },

  moveNote: async (fromPath: string, toPath: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.notes.moveNote(fromPath, toPath)
      const notes = await window.notes.listNotes()
      const config = await window.notes.getConfig()

      set({ config, notes, isLoading: false, error: null })

      // Update tab paths across all panes
      usePanesStore.getState().updateTabPath(fromPath, result.relativePath)
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to move file.')
      })
    }
  },

  createFolder: async (relativePath: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.notes.createFolder(relativePath)
      const notes = await window.notes.listNotes()
      set({ notes, isLoading: false, error: null })
      return result.relativePath
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to create folder.')
      })
      return null
    }
  },

  renameFolder: async (fromPath: string, toPath: string) => {
    set({ isLoading: true, error: null })

    try {
      await window.notes.renameFolder(fromPath, toPath)
      const notes = await window.notes.listNotes()

      set({ notes, isLoading: false, error: null })

      // Update all tab paths that were under the old folder
      const panesState = usePanesStore.getState()
      for (const pane of Object.values(panesState.panes)) {
        for (const tab of pane.tabs) {
          if (tab.relativePath.startsWith(fromPath + '/')) {
            usePanesStore
              .getState()
              .updateTabPath(tab.relativePath, tab.relativePath.replace(fromPath, toPath))
          }
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        error: errorMessage(error, 'Failed to rename folder.')
      })
    }
  },

  refreshNotesList: async () => {
    try {
      const notes = await window.notes.listNotes()
      set({ notes })
    } catch {
      // Silent failure — this is a background refresh
    }
  }
}))
