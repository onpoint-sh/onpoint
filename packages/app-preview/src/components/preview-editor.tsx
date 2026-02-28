import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { InputRule } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import { useEffect, useMemo, useRef } from 'react'
import { parseFrontmatter } from '@onpoint/shared/frontmatter'
import { useAppPreview } from '../context'

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

function setEditorMarkdown(editor: unknown, content: string): void {
  const typedEditor = editor as {
    commands: { setContent: (content: string, options?: unknown) => void }
  }
  try {
    typedEditor.commands.setContent(content, { contentType: 'markdown' })
  } catch {
    typedEditor.commands.setContent(content)
  }
}

type PreviewEditorProps = {
  relativePath: string | null
}

export function PreviewEditor({ relativePath }: PreviewEditorProps): React.JSX.Element {
  const { contentMap } = useAppPreview()
  const isSyncingRef = useRef(false)
  const loadedPathRef = useRef<string | null>(null)

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
      attributes: { class: 'notes-rich-editor' },
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
      }
    }
  })

  // Load content when relativePath changes
  useEffect(() => {
    if (!editor || !relativePath) return
    if (loadedPathRef.current === relativePath) return

    loadedPathRef.current = relativePath
    const rawContent = contentMap.get(relativePath) ?? ''
    const parsed = parseFrontmatter(rawContent)

    isSyncingRef.current = true
    try {
      setEditorMarkdown(editor, parsed.body)
    } finally {
      isSyncingRef.current = false
    }
  }, [relativePath, editor, contentMap])

  if (!relativePath) {
    return (
      <section className="preview-editor-section">
        <div className="preview-editor-empty">Open a note from the sidebar.</div>
      </section>
    )
  }

  return (
    <section className="preview-editor-section">
      <div
        className="preview-editor-scroll"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('.notes-rich-editor')) return
          event.preventDefault()
          editor?.commands.focus('end')
        }}
      >
        <EditorContent editor={editor} className="notes-rich-editor-container" />
      </div>
    </section>
  )
}
