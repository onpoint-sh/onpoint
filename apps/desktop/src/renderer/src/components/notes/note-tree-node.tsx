import { useMemo, useRef, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight } from 'lucide-react'
import { useIconThemeAdapter } from '@onpoint/icon-themes'
import type { TreeNameValidationResult } from '@onpoint/notes-core/file-name-validation'
import type { NoteTreeNode } from '@/lib/notes-tree'
import { getFileExtension } from '@/lib/file-types'
import { useIconThemeStore } from '@/stores/icon-theme-store'
import { usePanesStore } from '@/stores/panes-store'

const BASE_PADDING_LEFT = 12

const justCreatedIds = new Set<string>()
// eslint-disable-next-line react-refresh/only-export-components
export function markAsJustCreated(id: string): void {
  justCreatedIds.add(id)
}

export type ValidateTreeNodeNameInput = {
  id: string
  name: string
  isNote: boolean
}

type NoteTreeNodeRendererProps = NodeRendererProps<NoteTreeNode> & {
  validateName?: (input: ValidateTreeNodeNameInput) => TreeNameValidationResult | null
}

function ThemedIcon({ svg, className }: { svg: string; className?: string }): React.JSX.Element {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

function NoteTreeNodeRenderer({
  node,
  style,
  dragHandle,
  validateName
}: NoteTreeNodeRendererProps): React.JSX.Element {
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
  const isNonMdFile = node.data.isNote && !node.data.relativePath.toLowerCase().endsWith('.md')
  const [editValue, setEditValue] = useState(
    isNewNode
      ? ''
      : isNonMdFile
        ? (node.data.relativePath.split('/').pop() ?? node.data.name)
        : node.data.name
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const editValidation = useMemo(
    () =>
      node.isEditing && validateName
        ? validateName({
            id: node.id,
            name: editValue,
            isNote: node.data.isNote
          })
        : null,
    [node.id, node.isEditing, node.data.isNote, editValue, validateName]
  )

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
              {isNewNode ? <span className="inline-flex size-[14px] shrink-0" /> : fileIcon}
            </>
          ) : (
            <>
              <span className="inline-flex w-4 shrink-0 items-center justify-center">
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </span>
              {folderIcon(false)}
            </>
          )}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              autoFocus
              className={`h-auto w-full rounded-none border bg-sidebar p-0 text-[0.8rem] text-sidebar-foreground outline-none ${
                editValidation?.severity === 'error'
                  ? 'border-destructive'
                  : editValidation?.severity === 'warning'
                    ? 'border-amber-500/80'
                    : 'border-sidebar-ring'
              }`}
              value={editValue}
              aria-invalid={editValidation?.severity === 'error'}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (editValidation?.severity === 'error') {
                    inputRef.current?.focus()
                    return
                  }
                  justCreatedIds.delete(node.id)
                  node.submit(editValidation?.normalizedName ?? editValue)
                } else if (e.key === 'Escape') {
                  justCreatedIds.delete(node.id)
                  node.reset()
                }
              }}
              onBlur={() => {
                if (editValidation?.severity === 'error') {
                  requestAnimationFrame(() => {
                    inputRef.current?.focus()
                  })
                  return
                }
                justCreatedIds.delete(node.id)
                node.submit(editValidation?.normalizedName ?? editValue)
              }}
            />
            {editValidation ? (
              <div
                className={`note-tree-inline-validation ${editValidation.severity === 'error' ? 'is-error' : 'is-warning'}`}
              >
                {editValidation.message}
              </div>
            ) : null}
          </div>
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
        <span className="truncate font-normal text-sidebar-foreground">
          {node.data.isNote
            ? `${node.data.name}${getFileExtension(node.data.relativePath)}`
            : node.data.name}
        </span>
      </div>
    </div>
  )
}

export { NoteTreeNodeRenderer }
