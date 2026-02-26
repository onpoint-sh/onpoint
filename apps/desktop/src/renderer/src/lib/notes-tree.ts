import type { NoteSummary } from '@onpoint/shared/notes'

export type NoteTreeNode = {
  id: string
  name: string
  children?: NoteTreeNode[]
  isNote: boolean
  relativePath: string
  mtimeMs?: number
}

export function buildNotesTree(notes: NoteSummary[], extraFolders?: string[]): NoteTreeNode[] {
  const folderMap = new Map<string, NoteTreeNode>()
  const root: NoteTreeNode[] = []

  function ensureFolder(folderPath: string): NoteTreeNode {
    const existing = folderMap.get(folderPath)
    if (existing) return existing

    const segments = folderPath.split('/')
    const name = segments[segments.length - 1]
    const folder: NoteTreeNode = {
      id: `folder:${folderPath}`,
      name,
      children: [],
      isNote: false,
      relativePath: folderPath
    }

    folderMap.set(folderPath, folder)

    if (segments.length === 1) {
      root.push(folder)
    } else {
      const parentPath = segments.slice(0, -1).join('/')
      const parent = ensureFolder(parentPath)
      parent.children!.push(folder)
    }

    return folder
  }

  for (const note of notes) {
    const segments = note.relativePath.split('/')
    const noteNode: NoteTreeNode = {
      id: note.relativePath,
      name: note.title,
      isNote: true,
      relativePath: note.relativePath,
      mtimeMs: note.mtimeMs
    }

    if (segments.length === 1) {
      root.push(noteNode)
    } else {
      const folderPath = segments.slice(0, -1).join('/')
      const parent = ensureFolder(folderPath)
      parent.children!.push(noteNode)
    }
  }

  if (extraFolders) {
    for (const folderPath of extraFolders) {
      ensureFolder(folderPath)
    }
  }

  function sortChildren(nodes: NoteTreeNode[]): void {
    nodes.sort((a, b) => {
      if (!a.isNote && b.isNote) return -1
      if (a.isNote && !b.isNote) return 1
      if (!a.isNote && !b.isNote) return a.name.localeCompare(b.name)
      return (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0)
    })

    for (const node of nodes) {
      if (node.children) {
        sortChildren(node.children)
      }
    }
  }

  sortChildren(root)
  return root
}
