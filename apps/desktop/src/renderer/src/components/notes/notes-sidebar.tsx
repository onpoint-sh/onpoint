import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tree, type NodeApi, type TreeApi } from 'react-arborist'
import { useDragDropManager } from 'react-dnd'
import {
  ChevronRight,
  ChevronsDownUp,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Settings
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotesStore } from '@/stores/notes-store'
import { usePanesStore } from '@/stores/panes-store'
import { useTreeStateStore } from '@/stores/tree-state-store'
import { buildNotesTree, type NoteTreeNode } from '@/lib/notes-tree'
import { getFileExtension, hasFileExtension } from '@/lib/file-types'
import { NoteTreeNodeRenderer, markAsJustCreated } from './note-tree-node'
import useResizeObserver from './use-resize-observer'

const TREE_ROW_HEIGHT = 28

type StickyFolderRow = {
  id: string
  name: string
  relativePath: string
  level: number
}

function NotesSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const dndManager = useDragDropManager()
  const config = useNotesStore((s) => s.config)
  const notes = useNotesStore((s) => s.notes)
  const error = useNotesStore((s) => s.error)
  const pickVault = useNotesStore((s) => s.pickVault)
  const createNote = useNotesStore((s) => s.createNote)
  const renameNote = useNotesStore((s) => s.renameNote)
  const deleteNote = useNotesStore((s) => s.deleteNote)
  const archiveNote = useNotesStore((s) => s.archiveNote)
  const moveNote = useNotesStore((s) => s.moveNote)
  const createFolder = useNotesStore((s) => s.createFolder)
  const renameFolder = useNotesStore((s) => s.renameFolder)

  const expandedFolders = useTreeStateStore((s) => s.expandedFolders)
  const setExpandedFolders = useTreeStateStore((s) => s.setExpandedFolders)

  const treeRef = useRef<TreeApi<NoteTreeNode>>(null)
  const toggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)
  const [pendingFolders, setPendingFolders] = useState<Set<string>>(new Set())
  const [diskFolders, setDiskFolders] = useState<string[]>([])
  const [isTreeOpen, setIsTreeOpen] = useState(true)
  const [stickyFolderRows, setStickyFolderRows] = useState<StickyFolderRow[]>([])
  const clipboardRef = useRef<{ relativePaths: string[] } | null>(null)
  const scrollOffsetRef = useRef(0)
  const pendingNewNodeIds = useRef(new Set<string>())

  const vaultName = config.vaultPath?.split('/').pop() ?? 'Notes'

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

  // Fetch all folders from disk so empty ones appear in the tree
  useEffect(() => {
    let cancelled = false
    window.notes
      .listFolders()
      .then((folders) => {
        if (!cancelled) setDiskFolders(folders)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [notes])

  const treeData = useMemo(
    () => buildNotesTree(notes, [...new Set([...diskFolders, ...pendingFolders])]),
    [notes, diskFolders, pendingFolders]
  )

  const getFolderNodeFromTopNode = useCallback(
    (node: NodeApi<NoteTreeNode> | null): NodeApi<NoteTreeNode> | null => {
      if (!node) return null
      if (!node.data.isNote) return node
      const parent = node.parent
      if (!parent || parent.isRoot || parent.data.isNote) return null
      return parent
    },
    []
  )

  const refreshStickyFolderRows = useCallback(
    (scrollOffset: number) => {
      const tree = treeRef.current
      if (!tree) return
      const topIndex = Math.max(0, Math.floor(scrollOffset / TREE_ROW_HEIGHT))
      const topNode = tree.at(topIndex) ?? tree.firstNode
      const folderNode = getFolderNodeFromTopNode(topNode)
      if (!folderNode) {
        setStickyFolderRows((prev) => (prev.length === 0 ? prev : []))
        return
      }

      const chain: NodeApi<NoteTreeNode>[] = []
      let current: NodeApi<NoteTreeNode> | null = folderNode
      while (current && !current.isRoot && !current.data.isNote) {
        chain.unshift(current)
        current = current.parent
      }

      const nextRows: StickyFolderRow[] = []
      for (const [chainIndex, item] of chain.entries()) {
        const rowIndex = tree.indexOf(item.id)
        if (rowIndex === null || rowIndex === undefined) continue

        const rowTop = rowIndex * TREE_ROW_HEIGHT - scrollOffset
        const stickyTop = chainIndex * TREE_ROW_HEIGHT
        if (rowTop < stickyTop) {
          nextRows.push({
            id: item.id,
            name: item.data.name,
            relativePath: item.data.relativePath,
            level: item.level
          })
        }
      }

      setStickyFolderRows((prev) => {
        if (prev.length === nextRows.length && prev.every((row, i) => row.id === nextRows[i]?.id)) {
          return prev
        }
        return nextRows
      })
    },
    [getFolderNodeFromTopNode]
  )

  useEffect(() => {
    if (!isTreeOpen) return
    const frame = requestAnimationFrame(() => {
      refreshStickyFolderRows(scrollOffsetRef.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [isTreeOpen, treeData, refreshStickyFolderRows])

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
        const existingIds = new Set(
          treeData.flatMap(function collectIds(n): string[] {
            const ids = [n.id]
            if (n.children) ids.push(...n.children.flatMap(collectIds))
            return ids
          })
        )

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
        const folderId = `folder:${folderPath}`
        markAsJustCreated(folderId)
        return { id: folderId }
      }

      const note = await window.notes.createNote(undefined, parentPath)
      const updatedNotes = await window.notes.listNotes()
      useNotesStore.setState({ notes: updatedNotes })
      pendingNewNodeIds.current.add(note.relativePath)
      markAsJustCreated(note.relativePath)
      return { id: note.relativePath }
    },
    [treeData, pendingFolders]
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
        const isNewNode = pendingNewNodeIds.current.delete(id)

        if (isNewNode && hasFileExtension(name) && !name.toLowerCase().endsWith('.md')) {
          // New node with non-md extension: replace temp .md with the actual file
          const parentDir = id.split('/').slice(0, -1).join('/')
          const newPath = parentDir ? `${parentDir}/${name}` : name
          void (async () => {
            await window.notes.moveNote(id, newPath)
            await window.notes.saveNote(newPath, '')
            usePanesStore.getState().updateTabPath(id, newPath)
            usePanesStore.getState().openTab(newPath)
            void useNotesStore.getState().refreshNotesList()
          })()
        } else if (!isNewNode && !id.toLowerCase().endsWith('.md')) {
          // Existing non-md file: rename the file, preserving extension if not typed
          const ext = getFileExtension(id)
          const parentDir = id.split('/').slice(0, -1).join('/')
          const newFileName = hasFileExtension(name) ? name : `${name}${ext}`
          const newPath = parentDir ? `${parentDir}/${newFileName}` : newFileName
          if (id !== newPath) {
            void (async () => {
              await window.notes.moveNote(id, newPath)
              usePanesStore.getState().updateTabPath(id, newPath)
              void useNotesStore.getState().refreshNotesList()
            })()
          }
        } else {
          // .md file (new or existing): title rename via frontmatter
          const title = name.replace(/\.md$/i, '')
          usePanesStore.getState().openTab(id)
          void renameNote(id, title)
        }
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
    ({ dragIds, parentId }: { dragIds: string[]; parentId: string | null; index: number }) => {
      const targetFolder = parentId ? parentId.replace(/^folder:/, '') : ''

      for (const dragId of dragIds) {
        if (dragId.startsWith('folder:')) {
          const folderPath = dragId.replace(/^folder:/, '')
          const folderName = folderPath.split('/').pop()
          if (!folderName) continue

          const newPath = targetFolder ? `${targetFolder}/${folderName}` : folderName
          if (newPath !== folderPath) {
            void renameFolder(folderPath, newPath)
            setPendingFolders((prev) => {
              const next = new Set(prev)
              if (next.has(folderPath)) {
                next.delete(folderPath)
                next.add(newPath)
              }
              return next
            })
          }
          continue
        }

        const fileName = dragId.split('/').pop()
        if (!fileName) continue

        const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName
        if (newPath !== dragId) {
          void moveNote(dragId, newPath)
        }
      }
    },
    [moveNote, renameFolder]
  )

  const handleToggle = useCallback(() => {
    if (toggleTimerRef.current) clearTimeout(toggleTimerRef.current)
    toggleTimerRef.current = setTimeout(() => {
      const tree = treeRef.current
      if (!tree) return
      setExpandedFolders({ ...tree.openState })
    }, 0)
  }, [setExpandedFolders])

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      const tree = treeRef.current
      if (!tree) return

      // Identify the right-clicked node directly from the DOM
      const target = e.target as HTMLElement
      const nodeEl = target.closest<HTMLElement>('[data-node-id]')
      const nodeId = nodeEl?.dataset.nodeId ?? null
      const node = nodeId ? tree.get(nodeId) : null

      // Preserve multi-selection if right-clicked node is already selected
      if (node) {
        if (!node.isSelected) {
          node.select()
        }
        node.focus()
      }

      const selectedNodes = tree.selectedNodes
      const isMulti = selectedNodes.length > 1

      const isMac = window.windowControls.platform === 'darwin'
      const hasCut = clipboardRef.current !== null

      type Item = { id: string; label: string; separator?: boolean; accelerator?: string }

      // Build menu items based on what was right-clicked
      let items: Item[]

      if (!node) {
        items = [
          { id: 'new-note', label: 'New File' },
          { id: 'new-folder', label: 'New Folder' },
          ...(hasCut ? [{ id: 'paste', label: 'Paste', accelerator: 'CmdOrCtrl+V' }] : [])
        ]
      } else if (isMulti) {
        const hasNotes = selectedNodes.some((n) => n.data.isNote)
        items = [
          { id: 'cut', label: `Cut ${selectedNodes.length} Items`, accelerator: 'CmdOrCtrl+X' },
          { id: 'sep-1', label: '', separator: true },
          ...(hasNotes ? [{ id: 'archive', label: 'Archive' }] : []),
          { id: 'delete', label: `Delete ${selectedNodes.length} Items` }
        ]
      } else if (node.data.isNote) {
        items = [
          { id: 'cut', label: 'Cut', accelerator: 'CmdOrCtrl+X' },
          { id: 'copy-path', label: 'Copy Path', accelerator: 'CmdOrCtrl+C' },
          { id: 'sep-1', label: '', separator: true },
          { id: 'rename', label: 'Rename' },
          { id: 'archive', label: 'Archive' },
          { id: 'delete', label: 'Delete' },
          { id: 'sep-2', label: '', separator: true },
          ...(isMac
            ? [{ id: 'reveal', label: 'Reveal in Finder' }]
            : [{ id: 'reveal', label: 'Show in Explorer' }])
        ]
      } else {
        items = [
          { id: 'new-note', label: 'New File' },
          { id: 'new-folder', label: 'New Folder' },
          ...(hasCut ? [{ id: 'paste', label: 'Paste', accelerator: 'CmdOrCtrl+V' }] : []),
          { id: 'sep-1', label: '', separator: true },
          { id: 'cut', label: 'Cut', accelerator: 'CmdOrCtrl+X' },
          { id: 'copy-path', label: 'Copy Path', accelerator: 'CmdOrCtrl+C' },
          { id: 'sep-2', label: '', separator: true },
          { id: 'rename', label: 'Rename' },
          { id: 'delete', label: 'Delete' },
          { id: 'sep-3', label: '', separator: true },
          ...(isMac
            ? [{ id: 'reveal', label: 'Reveal in Finder' }]
            : [{ id: 'reveal', label: 'Show in Explorer' }])
        ]
      }

      const clickedId = await window.contextMenu.show(items)
      if (!clickedId) return

      const targets = isMulti ? selectedNodes : node ? [node] : []

      switch (clickedId) {
        case 'rename':
          node?.edit()
          break
        case 'archive':
          for (const n of targets) {
            if (n.data.isNote) void archiveNote(n.data.relativePath)
          }
          break
        case 'delete':
          for (const n of targets) {
            if (n.data.isNote) {
              void deleteNote(n.data.relativePath)
            } else {
              const folderPath = n.data.relativePath
              for (const note of notes.filter((x) => x.relativePath.startsWith(folderPath + '/'))) {
                void deleteNote(note.relativePath)
              }
            }
          }
          break
        case 'new-note':
          tree.createLeaf()
          break
        case 'new-folder':
          tree.createInternal()
          break
        case 'cut':
          clipboardRef.current = { relativePaths: targets.map((n) => n.data.relativePath) }
          break
        case 'copy-path':
          if (node) {
            void navigator.clipboard.writeText(node.data.relativePath)
          }
          break
        case 'paste': {
          const clip = clipboardRef.current
          if (!clip) break
          const targetFolder = node ? node.data.relativePath : ''
          for (const srcPath of clip.relativePaths) {
            const fileName = srcPath.split('/').pop()
            if (!fileName) continue
            const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName
            if (newPath !== srcPath) {
              void moveNote(srcPath, newPath)
            }
          }
          clipboardRef.current = null
          break
        }
        case 'reveal':
          if (node && config.vaultPath) {
            const absolutePath = `${config.vaultPath}/${node.data.relativePath}`
            void window.contextMenu.revealInFinder(absolutePath)
          }
          break
      }
    },
    [notes, config.vaultPath, createNote, deleteNote, archiveNote, moveNote]
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
          <div className="group -mx-3 flex items-center gap-0.5 px-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1 rounded-[calc(var(--radius)-2px)] py-0.5 text-[0.75rem] font-semibold uppercase tracking-wide text-sidebar-foreground/70 transition-colors duration-[120ms] hover:text-sidebar-foreground"
              onClick={() => setIsTreeOpen((prev) => !prev)}
            >
              <ChevronRight
                className={`size-3.5 shrink-0 transition-transform duration-150 ${isTreeOpen ? 'rotate-90' : ''}`}
              />
              <span className="truncate">{vaultName}</span>
            </button>
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100">
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
                title="New File"
                onClick={() => {
                  if (treeRef.current) {
                    void treeRef.current.createLeaf()
                  } else {
                    void createNote()
                  }
                }}
              >
                <FilePlus className="size-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
                title="New Folder"
                onClick={() => {
                  if (treeRef.current) {
                    void treeRef.current.createInternal()
                  } else {
                    void createFolder('New Folder')
                  }
                }}
              >
                <FolderPlus className="size-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
                title="Collapse All Folders"
                onClick={() => {
                  treeRef.current?.closeAll()
                  handleToggle()
                }}
              >
                <ChevronsDownUp className="size-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-transparent text-muted-foreground transition-colors duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] hover:text-sidebar-foreground"
                title="Open Folder"
                onClick={() => void pickVault()}
              >
                <FolderOpen className="size-3.5" />
              </button>
            </div>
          </div>

          {isTreeOpen && (
            <>
              {notes.length === 0 && pendingFolders.size === 0 ? (
                <p className="m-0 text-[0.76rem] leading-[1.35] text-muted-foreground">
                  No files found yet. Create your first file.
                </p>
              ) : (
                <div
                  ref={containerRef}
                  className="relative -mx-3 min-h-0 flex-1"
                  onContextMenu={handleContextMenu}
                >
                  <Tree<NoteTreeNode>
                    ref={treeRef}
                    data={treeData}
                    width="100%"
                    height={containerHeight}
                    rowHeight={TREE_ROW_HEIGHT}
                    indent={20}
                    openByDefault={false}
                    initialOpenState={expandedFolders}
                    dndManager={dndManager}
                    onToggle={handleToggle}
                    onScroll={({ scrollOffset }) => {
                      scrollOffsetRef.current = scrollOffset
                      refreshStickyFolderRows(scrollOffset)
                    }}
                    onCreate={handleCreate}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMove={handleMove}
                  >
                    {NoteTreeNodeRenderer}
                  </Tree>
                  {stickyFolderRows.map((row, index) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`absolute inset-x-0 z-10 flex h-7 w-full items-center gap-[5px] bg-sidebar pr-2 text-left text-[0.8rem] transition-[background-color,color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-foreground)_8%,var(--sidebar))] ${index === stickyFolderRows.length - 1 ? 'border-b border-border' : ''}`}
                      style={{ top: index * TREE_ROW_HEIGHT }}
                      title={row.relativePath}
                      onClick={() => {
                        treeRef.current?.get(row.id)?.toggle()
                        handleToggle()
                      }}
                    >
                      <div
                        className="flex h-full items-center gap-[5px] text-[0.8rem]"
                        style={{ paddingLeft: row.level * 20 + 12 }}
                      >
                        <span className="inline-flex w-4 shrink-0 items-center justify-center">
                          <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" />
                        </span>
                        <FolderOpen className="size-[14px] shrink-0 text-muted-foreground" />
                        <span className="truncate font-normal text-sidebar-foreground">
                          {row.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

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
