import { useEffect, useMemo, useRef, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight } from 'lucide-react'
import { DEFAULT_ICON_THEME_ID, loadIconTheme, useIconThemeAdapter } from '@onpoint/icon-themes'
import type { NoteTreeNode } from '@onpoint/notes-core/notes-tree'
import { usePreviewStore } from '../store'

const BASE_PADDING_LEFT = 12

const justCreatedIds = new Set<string>()
// eslint-disable-next-line react-refresh/only-export-components
export function markAsJustCreated(id: string): void {
  justCreatedIds.add(id)
}

function ThemedIcon({ svg, className }: { svg: string; className?: string }): React.JSX.Element {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function TreeNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<NoteTreeNode>): React.JSX.Element {
  const openTab = usePreviewStore((s) => s.openTab)
  const panes = usePreviewStore((s) => s.panes)
  const focusedPaneId = usePreviewStore((s) => s.focusedPaneId)
  const adapter = useIconThemeAdapter(DEFAULT_ICON_THEME_ID)

  useEffect(() => {
    void loadIconTheme(DEFAULT_ICON_THEME_ID)
  }, [])

  const isNewNode = justCreatedIds.has(node.id)
  const [editValue, setEditValue] = useState(isNewNode ? '' : node.data.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const contentStyle = useMemo(
    () => ({
      paddingLeft: ((style.paddingLeft as number) || 0) + BASE_PADDING_LEFT
    }),
    [style.paddingLeft]
  )

  // Determine if this note is the active tab in the focused pane
  const isActive = (() => {
    if (node.data.isNote && focusedPaneId) {
      const pane = panes[focusedPaneId]
      if (pane) {
        const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId)
        return activeTab?.relativePath === node.data.relativePath
      }
    }
    return false
  })()

  const fileName = node.data.relativePath.split('/').pop() ?? node.data.relativePath
  const folderName = node.data.relativePath.split('/').pop() ?? node.data.relativePath

  const fileIcon = adapter ? (
    <ThemedIcon
      svg={adapter.getFileIcon(fileName)}
      className="preview-tree-node-icon [&>svg]:size-full"
    />
  ) : (
    <span className="preview-tree-node-icon" />
  )

  const renderFolderIcon = (isOpen: boolean): React.JSX.Element =>
    adapter ? (
      <ThemedIcon
        svg={adapter.getFolderIcon(folderName, isOpen)}
        className="preview-tree-node-icon [&>svg]:size-full"
      />
    ) : (
      <span className="preview-tree-node-icon" />
    )

  if (node.isEditing) {
    return (
      <div className="preview-tree-node">
        <div className="preview-tree-node-content" style={contentStyle}>
          {node.isLeaf ? (
            <>
              <span className="preview-tree-node-chevron-space" />
              {fileIcon}
            </>
          ) : (
            <>
              <span className="preview-tree-node-chevron">
                <ChevronRight className="preview-tree-node-chevron-icon" />
              </span>
              {renderFolderIcon(false)}
            </>
          )}
          <input
            ref={inputRef}
            autoFocus
            className="preview-tree-node-input"
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
      className={`preview-tree-node group ${isActive ? 'is-active' : ''} ${node.isSelected && !isActive ? 'is-selected' : ''}`}
      onClick={() => {
        if (node.data.isNote) {
          openTab(node.data.relativePath)
        } else {
          node.toggle()
        }
      }}
    >
      <div className="preview-tree-node-content" style={contentStyle}>
        {node.data.isNote ? (
          <>
            <span className="preview-tree-node-chevron-space" />
            {fileIcon}
          </>
        ) : (
          <>
            <span className="preview-tree-node-chevron">
              <ChevronRight
                className={`preview-tree-node-chevron-icon ${node.isOpen ? 'is-open' : ''}`}
              />
            </span>
            {renderFolderIcon(node.isOpen)}
          </>
        )}
        <span className="preview-tree-node-label">{node.data.name}</span>
      </div>
    </div>
  )
}
