import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { MockNote } from './types'
import type { NoteSummary } from '@onpoint/shared/notes'
import { type NoteTreeNode, buildNotesTree } from '@onpoint/notes-core/notes-tree'
import { createPreviewStore, PreviewStoreContext } from './store'

type AppPreviewContextValue = {
  notes: NoteSummary[]
  tree: NoteTreeNode[]
  contentMap: Map<string, string>
  addNote: (parentPath?: string) => string
  addFolder: (parentPath?: string) => string
  renameNote: (relativePath: string, newName: string) => void
  renameFolder: (oldPath: string, newName: string) => void
}

const AppPreviewContext = createContext<AppPreviewContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAppPreview(): AppPreviewContextValue {
  const ctx = useContext(AppPreviewContext)
  if (!ctx) throw new Error('useAppPreview must be used within AppPreviewProvider')
  return ctx
}

let noteCounter = 0

export function AppPreviewProvider({
  notes: mockNotes,
  children
}: {
  notes: MockNote[]
  children: React.ReactNode
}): React.JSX.Element {
  const storeRef = useRef(createPreviewStore())

  const initial = useMemo(() => {
    const summaries: NoteSummary[] = mockNotes.map((n) => ({
      relativePath: n.relativePath,
      title: n.title,
      mtimeMs: n.mtimeMs,
      size: n.content.length
    }))

    const contentMap = new Map<string, string>()
    for (const note of mockNotes) {
      contentMap.set(note.relativePath, note.content)
    }

    return { summaries, contentMap }
  }, [mockNotes])

  const [notes, setNotes] = useState<NoteSummary[]>(initial.summaries)
  const [contentMap, setContentMap] = useState<Map<string, string>>(initial.contentMap)
  const [extraFolders, setExtraFolders] = useState<string[]>([])

  const tree = useMemo(() => buildNotesTree(notes, extraFolders), [notes, extraFolders])

  const addNote = useCallback((parentPath?: string): string => {
    noteCounter++
    const title = `Untitled ${noteCounter}`
    const fileName = `${title}.md`
    const relativePath = parentPath ? `${parentPath}/${fileName}` : fileName
    const now = Date.now()

    const summary: NoteSummary = {
      relativePath,
      title,
      mtimeMs: now,
      size: 0
    }

    const content = `---\ntitle: ${title}\ncreated: ${new Date(now).toISOString()}\n---\n\n`

    setNotes((prev) => [...prev, summary])
    setContentMap((prev) => {
      const next = new Map(prev)
      next.set(relativePath, content)
      return next
    })

    return relativePath
  }, [])

  const addFolder = useCallback(
    (parentPath?: string): string => {
      const baseName = 'New Folder'
      let folderName = baseName
      let counter = 2
      const existing = new Set([
        ...notes
          .map((n) => {
            const parts = n.relativePath.split('/')
            return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
          })
          .filter(Boolean),
        ...extraFolders
      ])

      while (true) {
        const candidate = parentPath ? `${parentPath}/${folderName}` : folderName
        if (!existing.has(candidate)) {
          setExtraFolders((prev) => [...prev, candidate])
          return candidate
        }
        folderName = `${baseName} ${counter++}`
      }
    },
    [notes, extraFolders]
  )

  const renameNote = useCallback((relativePath: string, newName: string) => {
    if (!newName.trim()) return

    // Build new relativePath with the new name
    const segments = relativePath.split('/')
    const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`
    segments[segments.length - 1] = newFileName
    const newRelativePath = segments.join('/')

    setNotes((prev) =>
      prev.map((n) =>
        n.relativePath === relativePath
          ? { ...n, relativePath: newRelativePath, title: newName.replace(/\.md$/, '') }
          : n
      )
    )

    setContentMap((prev) => {
      const next = new Map(prev)
      const content = next.get(relativePath)
      if (content !== undefined) {
        next.delete(relativePath)
        next.set(newRelativePath, content)
      }
      return next
    })
  }, [])

  const renameFolder = useCallback((oldPath: string, newName: string) => {
    if (!newName.trim()) return

    const segments = oldPath.split('/')
    segments[segments.length - 1] = newName
    const newPath = segments.join('/')

    if (oldPath === newPath) return

    // Update notes whose paths start with the old folder path
    setNotes((prev) =>
      prev.map((n) => {
        if (n.relativePath.startsWith(oldPath + '/')) {
          const newRelativePath = newPath + n.relativePath.slice(oldPath.length)
          return { ...n, relativePath: newRelativePath }
        }
        return n
      })
    )

    // Update contentMap keys
    setContentMap((prev) => {
      const next = new Map<string, string>()
      for (const [key, value] of prev) {
        if (key.startsWith(oldPath + '/')) {
          next.set(newPath + key.slice(oldPath.length), value)
        } else {
          next.set(key, value)
        }
      }
      return next
    })

    // Update extraFolders
    setExtraFolders((prev) =>
      prev.map((f) => {
        if (f === oldPath) return newPath
        if (f.startsWith(oldPath + '/')) return newPath + f.slice(oldPath.length)
        return f
      })
    )
  }, [])

  const value = useMemo(
    () => ({ notes, tree, contentMap, addNote, addFolder, renameNote, renameFolder }),
    [notes, tree, contentMap, addNote, addFolder, renameNote, renameFolder]
  )

  return (
    <PreviewStoreContext value={storeRef.current}>
      <AppPreviewContext value={value}>{children}</AppPreviewContext>
    </PreviewStoreContext>
  )
}
