import { useCallback, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { isUntitledPath } from '@onpoint/shared/notes'
import { usePaneContent } from '@/hooks/use-pane-content'
import { useMonacoTheme } from '@/hooks/use-monaco-theme'
import { usePanesStore } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'
import { tabSaveCallbacks } from '@/lib/tab-save-callbacks'

type CodeEditorProps = {
  tabId?: string
  relativePath: string | null
  focusRequestId?: number
  onFocusConsumed?: () => void
}

function CodeEditor({
  tabId,
  relativePath,
  focusRequestId = 0,
  onFocusConsumed
}: CodeEditorProps): React.JSX.Element {
  const { content, setContent, isDirty, saveError, flushSave, getContent } =
    usePaneContent(relativePath)
  const markTabDirty = usePanesStore((s) => s.markTabDirty)
  const markTabClean = usePanesStore((s) => s.markTabClean)
  const monacoTheme = useMonacoTheme()

  const relativePathRef = useRef(relativePath)
  const savingAsRef = useRef(false)

  useEffect(() => {
    relativePathRef.current = relativePath
  }, [relativePath])

  // Sync dirty state to the store
  useEffect(() => {
    if (!tabId) return
    if (isDirty) {
      markTabDirty(tabId)
    } else {
      markTabClean(tabId)
    }
  }, [tabId, isDirty, markTabDirty, markTabClean])

  // Register save callback
  useEffect(() => {
    if (!tabId || !relativePath) return

    const callback = async (): Promise<boolean> => {
      if (isUntitledPath(relativePath)) {
        const currentContent = getContent()
        const result = await window.notes.saveNoteAs(currentContent)
        if (!result) return false
        usePanesStore.getState().updateTabPath(relativePath, result.relativePath)
        void useNotesStore.getState().refreshNotesList()
        return true
      } else {
        await flushSave()
        return true
      }
    }

    tabSaveCallbacks.set(tabId, callback)
    return () => {
      tabSaveCallbacks.delete(tabId)
    }
  }, [tabId, relativePath, getContent, flushSave])

  const handleSaveAs = useCallback(async () => {
    if (savingAsRef.current) return
    savingAsRef.current = true
    try {
      const currentContent = getContent()
      const result = await window.notes.saveNoteAs(currentContent)
      if (!result) return
      const oldPath = relativePathRef.current
      if (oldPath) {
        usePanesStore.getState().updateTabPath(oldPath, result.relativePath)
      }
      void useNotesStore.getState().refreshNotesList()
    } finally {
      savingAsRef.current = false
    }
  }, [getContent])

  // Cmd+S / Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        const path = relativePathRef.current
        if (!path) return
        if (isUntitledPath(path)) {
          void handleSaveAs()
        } else {
          void flushSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveAs, flushSave])

  // Consume focus request
  useEffect(() => {
    if (!relativePath || !focusRequestId) return
    onFocusConsumed?.()
  }, [relativePath, focusRequestId, onFocusConsumed])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setContent(value)
      }
    },
    [setContent]
  )

  const fileName = relativePath?.split('/').pop() ?? 'file.txt'

  if (!relativePath) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex flex-1 items-center justify-center p-3 text-center text-[0.84rem] text-muted-foreground">
          Open a file from the sidebar.
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {saveError ? (
        <p className="m-0 border-b border-border bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)] px-2.5 py-[0.4rem] text-[0.74rem] text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="min-h-0 flex-1">
        <Editor
          path={fileName}
          value={content}
          onChange={handleEditorChange}
          theme={monacoTheme}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: true,
            automaticLayout: true,
            padding: { top: 8 }
          }}
        />
      </div>
    </section>
  )
}

export { CodeEditor }
