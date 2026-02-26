import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotesStore } from '@/stores/notes-store'

const AUTOSAVE_DELAY_MS = 700

export type PaneContentState = {
  content: string
  setContent: (content: string) => void
  isLoading: boolean
  isSaving: boolean
  saveError: string | null
  flushSave: () => Promise<void>
}

export function usePaneContent(relativePath: string | null): PaneContentState {
  const [content, setContentState] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const contentRef = useRef('')
  const dirtyRef = useRef(false)
  const relativePathRef = useRef(relativePath)
  const autosaveTimerRef = useRef<number | null>(null)
  const savingRef = useRef(false)

  // NOTE: relativePathRef is updated ONLY inside the load effect,
  // not during render. This prevents a race where a pending autosave
  // timer reads the new path but still has old content, which would
  // overwrite the new note's file with old content.

  const clearAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

  const saveNow = useCallback(async () => {
    clearAutosave()

    const path = relativePathRef.current
    if (!path || !dirtyRef.current || savingRef.current) return

    savingRef.current = true
    setIsSaving(true)
    setSaveError(null)

    try {
      await window.notes.saveNote(path, contentRef.current)
      dirtyRef.current = false
      setIsSaving(false)
      // Refresh notes list so sidebar titles update
      void useNotesStore.getState().refreshNotesList()
    } catch (error) {
      setIsSaving(false)
      setSaveError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Failed to save note.'
      )
    } finally {
      savingRef.current = false
    }
  }, [clearAutosave])

  const scheduleAutosave = useCallback(() => {
    clearAutosave()
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveNow()
    }, AUTOSAVE_DELAY_MS)
  }, [clearAutosave, saveNow])

  const setContent = useCallback(
    (newContent: string) => {
      if (newContent === contentRef.current) return
      contentRef.current = newContent
      dirtyRef.current = true
      setContentState(newContent)
      setSaveError(null)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  // Load content when relativePath changes.
  // Also flushes any dirty content for the PREVIOUS path before switching.
  useEffect(() => {
    // Flush dirty content for the old path before switching
    const oldPath = relativePathRef.current
    if (dirtyRef.current && oldPath) {
      void window.notes.saveNote(oldPath, contentRef.current).catch(() => {})
    }

    // Cancel any pending autosave (it was for the old path)
    clearAutosave()
    dirtyRef.current = false

    // NOW update the ref to the new path
    relativePathRef.current = relativePath

    if (!relativePath) {
      setContentState('')
      contentRef.current = ''
      return
    }

    let cancelled = false
    setIsLoading(true)
    setSaveError(null)

    void window.notes.openNote(relativePath).then(
      (doc) => {
        if (cancelled) return
        contentRef.current = doc.content
        dirtyRef.current = false
        setContentState(doc.content)
        setIsLoading(false)
      },
      (error) => {
        if (cancelled) return
        setIsLoading(false)
        setSaveError(
          error instanceof Error && error.message.length > 0
            ? error.message
            : 'Failed to load note.'
        )
      }
    )

    return () => {
      cancelled = true
    }
  }, [relativePath, clearAutosave])

  // Save on unmount
  useEffect(() => {
    return () => {
      clearAutosave()
      if (dirtyRef.current && relativePathRef.current) {
        // Fire and forget — component is unmounting
        void window.notes
          .saveNote(relativePathRef.current, contentRef.current)
          .catch(() => {})
      }
    }
  }, [clearAutosave])

  return {
    content,
    setContent,
    isLoading,
    isSaving,
    saveError,
    flushSave: saveNow
  }
}
