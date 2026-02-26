import { useMemo, useRef, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import type { NoteTreeNode } from '@/lib/notes-tree'
import { usePanesStore } from '@/stores/panes-store'

const BASE_PADDING_LEFT = 12

function NoteTreeNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<NoteTreeNode>): React.JSX.Element {
  const openTab = usePanesStore((s) => s.openTab)
  const focusedPane = usePanesStore((s) => {
    if (!s.focusedPaneId) return null
    return s.panes[s.focusedPaneId] ?? null
  })
  const activeTab = focusedPane?.tabs.find((t) => t.id === focusedPane.activeTabId)
  const isActive = node.data.isNote && node.data.relativePath === activeTab?.relativePath

  const [editValue, setEditValue] = useState(node.data.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const contentStyle = useMemo(
    () => ({
      paddingLeft: ((style.paddingLeft as number) || 0) + BASE_PADDING_LEFT
    }),
    [style.paddingLeft]
  )

  function handleClick(e: React.MouseEvent): void {
    if (node.data.isNote) {
      openTab(node.data.relativePath)
    } else {
      node.toggle()
    }
    node.handleClick(e)
  }

  if (node.isEditing) {
    return (
      <div className="flex h-full w-full items-center">
        <div className="flex flex-1 items-center gap-[5px] pr-2" style={contentStyle}>
          <span className="inline-flex w-4 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            className="h-[22px] flex-1 rounded-[3px] border border-sidebar-ring bg-sidebar px-1.5 text-[0.8rem] text-sidebar-foreground outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                node.submit(editValue)
              } else if (e.key === 'Escape') {
                node.reset()
              }
            }}
            onBlur={() => node.submit(editValue)}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={dragHandle}
      className={`group h-full w-full cursor-pointer transition-[background-color,color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-foreground)_8%,var(--sidebar))] ${
        isActive
          ? 'bg-[color-mix(in_oklch,var(--sidebar-foreground)_6%,var(--sidebar))]'
          : ''
      } ${node.isSelected && !isActive ? 'bg-[color-mix(in_oklch,var(--sidebar-foreground)_4%,var(--sidebar))]' : ''}`}
      onClick={handleClick}
      onDoubleClick={() => {
        if (node.data.isNote) {
          node.edit()
        }
      }}
    >
      <div className="flex h-full items-center gap-[5px] pr-2 text-[0.8rem]" style={contentStyle}>
        {node.data.isNote ? (
          <>
            <span className="inline-flex w-4 shrink-0" />
            <FileText className="size-[14px] shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-sidebar-foreground" />
          </>
        ) : (
          <>
            <span className="inline-flex w-4 shrink-0 items-center justify-center">
              <ChevronRight
                className={`size-3.5 text-muted-foreground transition-[transform,color] duration-150 group-hover:text-sidebar-foreground ${node.isOpen ? 'rotate-90' : ''}`}
              />
            </span>
            {node.isOpen ? (
              <FolderOpen className="size-[14px] shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-sidebar-foreground" />
            ) : (
              <Folder className="size-[14px] shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-sidebar-foreground" />
            )}
          </>
        )}
        <span className="truncate font-[520] text-sidebar-foreground">{node.data.name}</span>
      </div>
    </div>
  )
}

export { NoteTreeNodeRenderer }
