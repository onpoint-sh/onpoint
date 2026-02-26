import { useEffect, useRef } from 'react'
import {
  Archive,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2
} from 'lucide-react'

type ContextMenuPosition = {
  x: number
  y: number
}

type ContextMenuItem = {
  label: string
  icon: React.ReactNode
  action: () => void
  destructive?: boolean
}

type NoteTreeContextMenuProps = {
  position: ContextMenuPosition
  items: ContextMenuItem[]
  onClose: () => void
}

function NoteTreeContextMenu({
  position,
  items,
  onClose
}: NoteTreeContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-[var(--radius)] border border-sidebar-border bg-sidebar py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.76rem] transition-colors duration-75 ${
            item.destructive
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-sidebar-foreground hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)]'
          }`}
          onClick={() => {
            item.action()
            onClose()
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

function buildNoteMenuItems(handlers: {
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
}): ContextMenuItem[] {
  return [
    { label: 'Rename', icon: <Pencil className="size-3.5" />, action: handlers.onRename },
    { label: 'Archive', icon: <Archive className="size-3.5" />, action: handlers.onArchive },
    {
      label: 'Delete',
      icon: <Trash2 className="size-3.5" />,
      action: handlers.onDelete,
      destructive: true
    }
  ]
}

function buildFolderMenuItems(handlers: {
  onNewNote: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
}): ContextMenuItem[] {
  return [
    { label: 'New Note', icon: <FilePlus className="size-3.5" />, action: handlers.onNewNote },
    {
      label: 'New Folder',
      icon: <FolderPlus className="size-3.5" />,
      action: handlers.onNewFolder
    },
    { label: 'Rename', icon: <Pencil className="size-3.5" />, action: handlers.onRename },
    {
      label: 'Delete',
      icon: <Trash2 className="size-3.5" />,
      action: handlers.onDelete,
      destructive: true
    }
  ]
}

function buildBackgroundMenuItems(handlers: {
  onNewNote: () => void
  onNewFolder: () => void
}): ContextMenuItem[] {
  return [
    { label: 'New Note', icon: <FilePlus className="size-3.5" />, action: handlers.onNewNote },
    {
      label: 'New Folder',
      icon: <FolderPlus className="size-3.5" />,
      action: handlers.onNewFolder
    }
  ]
}

export {
  NoteTreeContextMenu,
  buildNoteMenuItems,
  buildFolderMenuItems,
  buildBackgroundMenuItems,
  type ContextMenuPosition,
  type ContextMenuItem
}
