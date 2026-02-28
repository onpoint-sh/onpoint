import { useMemo, useRef, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import type { NoteTreeNode } from '@onpoint/notes-core/notes-tree'
import { usePreviewStore } from '../store'

const BASE_PADDING_LEFT = 12

const justCreatedIds = new Set<string>()
// eslint-disable-next-line react-refresh/only-export-components
export function markAsJustCreated(id: string): void {
  justCreatedIds.add(id)
}

export function TreeNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<NoteTreeNode>): React.JSX.Element {
  const openTab = usePreviewStore((s) => s.openTab)
  const panes = usePreviewStore((s) => s.panes)
  const focusedPaneId = usePreviewStore((s) => s.focusedPaneId)

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

  if (node.isEditing) {
    return (
      <div className="preview-tree-node">
        <div className="preview-tree-node-content" style={contentStyle}>
          {node.isLeaf ? (
            <>
              <span className="preview-tree-node-chevron-space" />
              <FileText className="preview-tree-node-icon" />
            </>
          ) : (
            <>
              <span className="preview-tree-node-chevron">
                <ChevronRight className="preview-tree-node-chevron-icon" />
              </span>
              <Folder className="preview-tree-node-icon" />
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
            <FileText className="preview-tree-node-icon" />
          </>
        ) : (
          <>
            <span className="preview-tree-node-chevron">
              <ChevronRight
                className={`preview-tree-node-chevron-icon ${node.isOpen ? 'is-open' : ''}`}
              />
            </span>
            {node.isOpen ? (
              <FolderOpen className="preview-tree-node-icon" />
            ) : (
              <Folder className="preview-tree-node-icon" />
            )}
          </>
        )}
        <span className="preview-tree-node-label">{node.data.name}</span>
      </div>
    </div>
  )
}
