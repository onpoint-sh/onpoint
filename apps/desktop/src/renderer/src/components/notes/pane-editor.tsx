import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { InputRule } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import { marked } from 'marked'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { isUntitledPath } from '@onpoint/shared/notes'
import { usePaneContent } from '@/hooks/use-pane-content'
import { usePanesStore } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'
import { parseFrontmatter } from '@onpoint/shared/frontmatter'
import { tabSaveCallbacks } from '@/lib/tab-save-callbacks'

const lowlight = createLowlight(common)

const LinkWithMarkdownShortcut = Link.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /\[([^\]]+)\]\((\S+)\)$/,
        handler: ({ state, range, match }) => {
          const { tr } = state
          const [, text, url] = match
          if (text && url) {
            tr.replaceWith(
              range.from,
              range.to,
              state.schema.text(text, [state.schema.marks.link.create({ href: url })])
            )
          }
        }
      })
    ]
  }
})

function getEditorMarkdown(editor: unknown): string {
  const typedEditor = editor as {
    getMarkdown?: () => string
    getText: () => string
    storage?: {
      markdown?: {
        getMarkdown?: () => string
      }
    }
  }

  if (typeof typedEditor.getMarkdown === 'function') {
    return typedEditor.getMarkdown()
  }

  if (typeof typedEditor.storage?.markdown?.getMarkdown === 'function') {
    return typedEditor.storage.markdown.getMarkdown()
  }

  return typedEditor.getText()
}

function setEditorMarkdown(editor: unknown, content: string): void {
  const typedEditor = editor as {
    commands: {
      setContent: (content: string, options?: unknown) => void
    }
  }

  try {
    typedEditor.commands.setContent(content, { contentType: 'markdown' })
  } catch {
    typedEditor.commands.setContent(content)
  }
}

type PaneEditorProps = {
  tabId?: string
  relativePath: string | null
  focusRequestId?: number
  onFocusConsumed?: () => void
}

function PaneEditor({
  tabId,
  relativePath,
  focusRequestId = 0,
  onFocusConsumed
}: PaneEditorProps): React.JSX.Element {
  const { content, setContent, isLoading, isDirty, saveError, flushSave, getContent } = usePaneContent(relativePath)
  const markTabDirty = usePanesStore((s) => s.markTabDirty)
  const markTabClean = usePanesStore((s) => s.markTabClean)

  const isSyncingRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const frontmatterRef = useRef('')
  const relativePathRef = useRef(relativePath)
  const savingAsRef = useRef(false)

  useEffect(() => {
    relativePathRef.current = relativePath
  }, [relativePath])

  // Sync dirty state to the store so the tab bar can show indicators
  useEffect(() => {
    if (!tabId) return
    if (isDirty) {
      markTabDirty(tabId)
    } else {
      markTabClean(tabId)
    }
  }, [tabId, isDirty, markTabDirty, markTabClean])

  // NOTE: We intentionally do NOT markTabClean on unmount here.
  // The editor unmounts on tab switch (due to key prop), but the tab
  // is still dirty. Cleanup happens in closeTab() in the store.

  // Register save callback so the tab bar can trigger saves on dirty-close
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

  const extensions = useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      LinkWithMarkdownShortcut.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto']
      }),
      Markdown
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'notes-rich-editor'
      },
      handleKeyDown: (view, event) => {
        const { state } = view
        const { $from } = state.selection
        const inCodeBlock = $from.parent.type.name === 'codeBlock'
        if (!inCodeBlock) return false

        if (event.key === 'Tab') {
          event.preventDefault()

          if (event.shiftKey) {
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
            const lineStart = textBefore.lastIndexOf('\n') + 1
            const linePrefix = $from.parent.textContent.slice(lineStart, lineStart + 2)
            const spacesToRemove = linePrefix === '  ' ? 2 : linePrefix.startsWith(' ') ? 1 : 0
            if (spacesToRemove > 0) {
              const absoluteLineStart = $from.start() + lineStart
              const tr = state.tr.delete(absoluteLineStart, absoluteLineStart + spacesToRemove)
              view.dispatch(tr)
            }
          } else {
            view.dispatch(state.tr.insertText('  '))
          }

          return true
        }

        if (event.key === 'Enter') {
          const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
          const lineStart = textBefore.lastIndexOf('\n') + 1
          const currentLine = textBefore.slice(lineStart)
          const indent = currentLine.match(/^(\s*)/)?.[1] ?? ''
          view.dispatch(state.tr.insertText('\n' + indent))
          return true
        }

        return false
      },
      handlePaste: (_view, event) => {
        const clipboardHtml = event.clipboardData?.getData('text/html') ?? ''

        if (clipboardHtml.includes('data-pm-slice')) {
          return false
        }

        const text = event.clipboardData?.getData('text/plain')

        if (!text || !editorRef.current) {
          return false
        }

        const html = marked.parse(text, { async: false }) as string
        editorRef.current.commands.insertContent(html)
        return true
      }
    },
    onUpdate: ({ editor: editorInstance }) => {
      if (isSyncingRef.current) {
        return
      }

      try {
        const bodyMarkdown = getEditorMarkdown(editorInstance)
        setContent(frontmatterRef.current + bodyMarkdown)
      } catch (error) {
        console.error('Failed to read markdown from rich editor.', error)
      }
    }
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // Sync content from hook → editor
  useEffect(() => {
    if (!editor) return

    const parsed = parseFrontmatter(content)
    const body = parsed.body
    frontmatterRef.current = content.slice(0, content.length - body.length)

    const currentMarkdown = getEditorMarkdown(editor)

    if (currentMarkdown === body) return

    isSyncingRef.current = true

    try {
      setEditorMarkdown(editor, body)
    } catch (error) {
      console.error('Failed to update rich editor content from markdown source.', error)
    } finally {
      isSyncingRef.current = false
    }
  }, [content, editor])

  // Update editable state — allow editing for untitled tabs too
  useEffect(() => {
    if (!editor) return
    const isUntitled = relativePath ? isUntitledPath(relativePath) : false
    editor.setEditable(Boolean(relativePath && (isUntitled || !isLoading)))
  }, [relativePath, editor, isLoading])

  // Handle focus requests
  useEffect(() => {
    if (!editor || !relativePath || !focusRequestId) return

    const frame = window.requestAnimationFrame(() => {
      editor.commands.focus('start')
      onFocusConsumed?.()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [relativePath, editor, focusRequestId, onFocusConsumed])

  if (!relativePath) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex flex-1 items-center justify-center p-3 text-center text-[0.84rem] text-muted-foreground">
          Open a note from the sidebar.
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

      <div
        className="min-h-0 flex-1 bg-background"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement

          if (target.closest('.notes-rich-editor')) {
            return
          }

          event.preventDefault()
          editor?.commands.focus('end')
        }}
      >
        <EditorContent editor={editor} className="notes-rich-editor-container" />
      </div>
    </section>
  )
}

export { PaneEditor }
