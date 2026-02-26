import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tree, type TreeApi } from 'react-arborist'
import { useDragDropManager } from 'react-dnd'
import { FilePlus, FolderOpen, FolderPlus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotesStore } from '@/stores/notes-store'
import { usePanesStore } from '@/stores/panes-store'
import { buildNotesTree, type NoteTreeNode } from '@/lib/notes-tree'
import { NoteTreeNodeRenderer } from './note-tree-node'
import {
  NoteTreeContextMenu,
  buildNoteMenuItems,
  buildFolderMenuItems,
  buildBackgroundMenuItems,
  type ContextMenuPosition,
  type ContextMenuItem
} from './note-tree-context-menu'
import useResizeObserver from './use-resize-observer'

function NotesSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const dndManager = useDragDropManager()
  const config = useNotesStore((s) => s.config)
  const notes = useNotesStore((s) => s.notes)
  const focusedPane = usePanesStore((s) => {
    if (!s.focusedPaneId) return null
    return s.panes[s.focusedPaneId] ?? null
  })
  const activeRelativePath = focusedPane?.tabs.find((t) => t.id === focusedPane.activeTabId)?.relativePath ?? null
  const error = useNotesStore((s) => s.error)
  const pickVault = useNotesStore((s) => s.pickVault)
  const createNote = useNotesStore((s) => s.createNote)
  const renameNote = useNotesStore((s) => s.renameNote)
  const deleteNote = useNotesStore((s) => s.deleteNote)
  const archiveNote = useNotesStore((s) => s.archiveNote)
  const moveNote = useNotesStore((s) => s.moveNote)
  const createFolder = useNotesStore((s) => s.createFolder)
  const renameFolder = useNotesStore((s) => s.renameFolder)

  const treeRef = useRef<TreeApi<NoteTreeNode>>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)
  const [pendingFolders, setPendingFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition
    items: ContextMenuItem[]
  } | null>(null)

  useResizeObserver(containerRef, (entry) => {
    setContainerHeight(entry.contentRect.height)
  })

  // Remove pending folders once they contain notes
  useEffect(() => {
    if (pendingFolders.size === 0) return
    const next = new Set(pendingFolders)
    for (const folder of pendingFolders) {
      if (notes.some((n) => n.relativePath.startsWith(folder + '/'))) {
        next.delete(folder)
      }
    }
    if (next.size !== pendingFolders.size) setPendingFolders(next)
  }, [notes, pendingFolders])

  const treeData = useMemo(
    () => buildNotesTree(notes, [...pendingFolders]),
    [notes, pendingFolders]
  )

  const handleCreate = useCallback(
    async ({
      parentId,
      type
    }: {
      parentId: string | null
      index: number
      type: 'internal' | 'leaf'
    }): Promise<{ id: string } | null> => {
      const parentPath = parentId ? parentId.replace(/^folder:/, '') : undefined

      if (type === 'internal') {
        let folderName = 'New Folder'
        let counter = 2
        const existingIds = new Set(treeData.flatMap(function collectIds(n): string[] {
          const ids = [n.id]
          if (n.children) ids.push(...n.children.flatMap(collectIds))
          return ids
        }))
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const candidatePath = parentPath ? `${parentPath}/${folderName}` : folderName
          if (!existingIds.has(`folder:${candidatePath}`) && !pendingFolders.has(candidatePath)) {
            break
          }
          folderName = `New Folder ${counter}`
          counter += 1
        }

        const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName
        await window.notes.createFolder(folderPath)
        setPendingFolders((prev) => new Set([...prev, folderPath]))
        return { id: `folder:${folderPath}` }
      }

      const notePath = await createNote(parentPath)
      if (!notePath) return null
      return { id: notePath }
    },
    [createNote, treeData, pendingFolders]
  )

  const handleRename = useCallback(
    ({ id, name }: { id: string; name: string }) => {
      if (id.startsWith('folder:')) {
        const oldPath = id.replace(/^folder:/, '')
        const segments = oldPath.split('/')
        segments[segments.length - 1] = name
        const newPath = segments.join('/')
        if (oldPath === newPath) return

        void renameFolder(oldPath, newPath)
        setPendingFolders((prev) => {
          const next = new Set(prev)
          if (next.has(oldPath)) {
            next.delete(oldPath)
            next.add(newPath)
          }
          return next
        })
      } else {
        void renameNote(id, name)
      }
    },
    [renameNote, renameFolder]
  )

  const handleDelete = useCallback(
    ({ ids }: { ids: string[] }) => {
      for (const id of ids) {
        if (id.startsWith('folder:')) {
          const folderPath = id.replace(/^folder:/, '')
          const folderNotes = notes.filter((n) => n.relativePath.startsWith(folderPath + '/'))
          for (const note of folderNotes) {
            void deleteNote(note.relativePath)
          }
        } else {
          void deleteNote(id)
        }
      }
    },
    [deleteNote, notes]
  )

  const handleMove = useCallback(
    ({
      dragIds,
      parentId
    }: {
      dragIds: string[]
      parentId: string | null
      index: number
    }) => {
      const targetFolder = parentId ? parentId.replace(/^folder:/, '') : ''

      for (const dragId of dragIds) {
        if (dragId.startsWith('folder:')) continue

        const fileName = dragId.split('/').pop()
        if (!fileName) continue

        const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName
        if (newPath !== dragId) {
          void moveNote(dragId, newPath)
        }
      }
    },
    [moveNote]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const tree = treeRef.current
      if (!tree) return

      const position = { x: e.clientX, y: e.clientY }

      // Find the node at the click position
      const target = e.target as HTMLElement
      const nodeRow = target.closest('[data-testid="row"]') ?? target.closest('[role="treeitem"]')

      if (nodeRow) {
        // Get the focused/selected node
        const focusedNode = tree.focusedNode
        if (focusedNode) {
          if (focusedNode.data.isNote) {
            setContextMenu({
              position,
              items: buildNoteMenuItems({
                onRename: () => focusedNode.edit(),
                onArchive: () => void archiveNote(focusedNode.data.relativePath),
                onDelete: () => void deleteNote(focusedNode.data.relativePath)
              })
            })
          } else {
            setContextMenu({
              position,
              items: buildFolderMenuItems({
                onNewNote: () => void createNote(focusedNode.data.relativePath),
                onNewFolder: () => {
                  const folderPath = `${focusedNode.data.relativePath}/New Folder`
                  void createFolder(folderPath)
                },
                onRename: () => focusedNode.edit(),
                onDelete: () => {
                  const folderPath = focusedNode.data.relativePath
                  const folderNotes = notes.filter((n) =>
                    n.relativePath.startsWith(folderPath + '/')
                  )
                  for (const note of folderNotes) {
                    void deleteNote(note.relativePath)
                  }
                }
              })
            })
          }
          return
        }
      }

      // Background context menu
      setContextMenu({
        position,
        items: buildBackgroundMenuItems({
          onNewNote: () => void createNote(),
          onNewFolder: () => void createFolder('New Folder')
        })
      })
    },
    [notes, createNote, createFolder, deleteNote, archiveNote]
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      {error ? <p className="m-0 text-[0.72rem] text-destructive">{error}</p> : null}

      {!config.vaultPath ? (
        <div className="flex flex-col gap-2.5 px-1 pt-0.5">
          <p className="m-0 text-[0.76rem] leading-[1.35] text-muted-foreground">
            You have not yet opened a folder.
          </p>
          <button
            type="button"
            className="inline-flex h-[1.85rem] w-full items-center justify-center gap-1.5 rounded-[calc(var(--radius)-1px)] bg-[var(--ring)] px-3 text-[0.78rem] font-medium text-[var(--background)] transition-opacity duration-[120ms] hover:opacity-90"
            onClick={() => void pickVault()}
          >
            Open Folder
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
              title="New Note"
              onClick={() => {
                if (treeRef.current) {
                  void treeRef.current.createLeaf()
                } else {
                  void createNote()
                }
              }}
            >
              <FilePlus className="size-4" />
            </button>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
              title="New Folder"
              onClick={() => {
                if (treeRef.current) {
                  void treeRef.current.createInternal()
                } else {
                  void createFolder('New Folder')
                }
              }}
            >
              <FolderPlus className="size-4" />
            </button>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
              title="Open Folder"
              onClick={() => void pickVault()}
            >
              <FolderOpen className="size-4" />
            </button>
          </div>

          {notes.length === 0 && pendingFolders.size === 0 ? (
            <p className="m-0 text-[0.76rem] leading-[1.35] text-muted-foreground">
              No markdown files found yet. Create your first note.
            </p>
          ) : (
            <div
              ref={containerRef}
              className="-mx-3 min-h-0 flex-1"
              onContextMenu={handleContextMenu}
            >
              <Tree<NoteTreeNode>
                ref={treeRef}
                data={treeData}
                width="100%"
                height={containerHeight}
                rowHeight={28}
                indent={20}
                openByDefault={false}
                selection={activeRelativePath ?? undefined}
                disableMultiSelection
                dndManager={dndManager}
                onCreate={handleCreate}
                onRename={handleRename}
                onDelete={handleDelete}
                onMove={handleMove}
              >
                {NoteTreeNodeRenderer}
              </Tree>
            </div>
          )}
        </>
      )}

      {contextMenu ? (
        <NoteTreeContextMenu
          position={contextMenu.position}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <div className="mt-auto flex pt-2">
        <button
          type="button"
          className="inline-flex h-[1.95rem] w-full items-center justify-start gap-[0.4rem] rounded-[calc(var(--radius)-2px)] border border-transparent bg-transparent px-[0.55rem] text-[0.75rem] font-medium text-sidebar-foreground transition-[background-color,color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_78%,transparent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          onClick={() => {
            navigate('/settings/keyboard-shortcuts')
          }}
        >
          <Settings className="size-4" />
          Settings
        </button>
      </div>
    </section>
  )
}

export { NotesSidebar }
