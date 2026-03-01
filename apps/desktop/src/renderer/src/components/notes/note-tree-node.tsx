import { useMemo, useRef, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight } from 'lucide-react'
import { useIconThemeAdapter } from '@onpoint/icon-themes'
import type { NoteTreeNode } from '@/lib/notes-tree'
import { useIconThemeStore } from '@/stores/icon-theme-store'
import { usePanesStore } from '@/stores/panes-store'

const BASE_PADDING_LEFT = 12

const justCreatedIds = new Set<string>()
// eslint-disable-next-line react-refresh/only-export-components
export function markAsJustCreated(id: string): void {
  justCreatedIds.add(id)
}

function ThemedIcon({ svg, className }: { svg: string; className?: string }): React.JSX.Element {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

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

  const iconThemeId = useIconThemeStore((s) => s.iconThemeId)
  const adapter = useIconThemeAdapter(iconThemeId)

  const isNewNode = justCreatedIds.has(node.id)
  const [editValue, setEditValue] = useState(isNewNode ? '' : node.data.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const contentStyle = useMemo(
    () => ({
      paddingLeft: ((style.paddingLeft as number) || 0) + BASE_PADDING_LEFT
    }),
    [style.paddingLeft]
  )

  const fileName = node.data.relativePath.split('/').pop() ?? node.data.relativePath
  const folderName = node.data.relativePath.split('/').pop() ?? node.data.relativePath

  function handleClick(e: React.MouseEvent): void {
    if (node.data.isNote) {
      openTab(node.data.relativePath, undefined, { focus: false })
    } else {
      node.toggle()
    }
    node.handleClick(e)
  }

  const fileIcon = adapter ? (
    <ThemedIcon
      svg={adapter.getFileIcon(fileName)}
      className="inline-flex size-[14px] shrink-0 items-center justify-center [&>svg]:size-full"
    />
  ) : (
    <span className="inline-flex size-[14px] shrink-0" />
  )

  const folderIcon = (isOpen: boolean): React.JSX.Element =>
    adapter ? (
      <ThemedIcon
        svg={adapter.getFolderIcon(folderName, isOpen)}
        className="inline-flex size-[14px] shrink-0 items-center justify-center [&>svg]:size-full"
      />
    ) : (
      <span className="inline-flex size-[14px] shrink-0" />
    )

  if (node.isEditing) {
    return (
      <div className="flex h-full w-full items-center">
        <div className="flex flex-1 items-center gap-[5px] pr-2" style={contentStyle}>
          {node.isLeaf ? (
            <>
              <span className="inline-flex w-4 shrink-0" />
              {fileIcon}
            </>
          ) : (
            <>
              <span className="inline-flex w-4 shrink-0 items-center justify-center">
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </span>
              {folderIcon(false)}
            </>
          )}
          <input
            ref={inputRef}
            autoFocus
            className="h-auto flex-1 rounded-none border border-sidebar-ring bg-sidebar p-0 text-[0.8rem] text-sidebar-foreground outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                justCreatedIds.delete(node.id)
                node.submit(editValue)
              } else if (e.key === 'Escape') {
                justCreatedIds.delete(node.id)
                node.reset()
              }
            }}
            onBlur={() => {
              justCreatedIds.delete(node.id)
              node.submit(editValue)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={dragHandle}
      data-node-id={node.id}
      className={`group h-full w-full cursor-pointer transition-[background-color,color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_82%,transparent)] ${
        isActive ? 'bg-[color-mix(in_oklch,var(--sidebar-accent)_60%,transparent)]' : ''
      } ${node.isSelected && !isActive ? 'bg-[color-mix(in_oklch,var(--sidebar-accent)_50%,transparent)]' : ''}`}
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
            {fileIcon}
          </>
        ) : (
          <>
            <span className="inline-flex w-4 shrink-0 items-center justify-center">
              <ChevronRight
                className={`size-3.5 text-muted-foreground transition-[transform,color] duration-150 group-hover:text-sidebar-foreground ${node.isOpen ? 'rotate-90' : ''}`}
              />
            </span>
            {folderIcon(node.isOpen)}
          </>
        )}
        <span className="truncate font-[520] text-sidebar-foreground">{node.data.name}</span>
      </div>
    </div>
  )
}

export { NoteTreeNodeRenderer }
