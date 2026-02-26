import { useCallback, useEffect, useRef, useState } from 'react'
import { isUntitledPath } from '@onpoint/shared/notes'
import { useNotesStore } from '@/stores/notes-store'
import {
  getUntitledContent,
  setUntitledContent
} from '@/lib/untitled-content-store'

const AUTOSAVE_DELAY_MS = 700

export type PaneContentState = {
  content: string
  setContent: (content: string) => void
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  saveError: string | null
  flushSave: () => Promise<void>
  getContent: () => string
}

export function usePaneContent(relativePath: string | null): PaneContentState {
  const [content, setContentState] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
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

    // Untitled tabs don't autosave — they require an explicit Save As
    if (isUntitledPath(path)) return

    savingRef.current = true
    setIsSaving(true)
    setSaveError(null)

    try {
      await window.notes.saveNote(path, contentRef.current)
      dirtyRef.current = false
      setIsSaving(false)
      setIsDirty(false)
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
    // Don't schedule autosave for untitled tabs
    if (relativePathRef.current && isUntitledPath(relativePathRef.current)) return
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
      setIsDirty(true)
      setSaveError(null)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const getContent = useCallback(() => contentRef.current, [])

  // Load content when relativePath changes.
  // Also flushes any dirty content for the PREVIOUS path before switching.
  useEffect(() => {
    // Flush dirty content for the old path before switching
    const oldPath = relativePathRef.current
    if (oldPath && dirtyRef.current) {
      if (isUntitledPath(oldPath)) {
        setUntitledContent(oldPath, contentRef.current)
      } else {
        void window.notes.saveNote(oldPath, contentRef.current).catch(() => {})
      }
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

    // Untitled tabs: restore from in-memory store (preserves content across tab switches)
    if (isUntitledPath(relativePath)) {
      const restored = getUntitledContent(relativePath)
      contentRef.current = restored
      setContentState(restored)
      if (restored !== '') {
        dirtyRef.current = true
        setIsDirty(true)
      } else {
        setIsDirty(false)
      }
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
        setIsDirty(false)
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
      const path = relativePathRef.current
      if (!path) return

      if (isUntitledPath(path)) {
        // Preserve untitled content in memory for when tab is re-activated
        setUntitledContent(path, contentRef.current)
      } else if (dirtyRef.current) {
        // Fire and forget — component is unmounting
        void window.notes
          .saveNote(path, contentRef.current)
          .catch(() => {})
      }
    }
  }, [clearAutosave])

  return {
    content,
    setContent,
    isLoading,
    isSaving,
    isDirty,
    saveError,
    flushSave: saveNow,
    getContent
  }
}
