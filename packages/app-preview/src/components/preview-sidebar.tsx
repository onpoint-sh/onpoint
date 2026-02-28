import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { Tree, type TreeApi } from 'react-arborist'
import { useDragDropManager } from 'react-dnd'
import type { NoteTreeNode } from '@onpoint/notes-core/notes-tree'
import { useAppPreview } from '../context'
import { usePreviewStoreApi } from '../store'
import { TreeNodeRenderer, markAsJustCreated } from './tree-node'

export type PreviewSidebarHandle = {
  createLeaf: () => void
  createInternal: () => void
}

type PreviewSidebarProps = {
  height: number
}

export const PreviewSidebar = forwardRef<PreviewSidebarHandle, PreviewSidebarProps>(
  function PreviewSidebar({ height }, ref) {
    const { tree, addNote, addFolder, renameNote, renameFolder } = useAppPreview()
    const treeRef = useRef<TreeApi<NoteTreeNode>>(null)
    const storeApi = usePreviewStoreApi()
    const dndManager = useDragDropManager()

    useImperativeHandle(ref, () => ({
      createLeaf: () => treeRef.current?.createLeaf(),
      createInternal: () => treeRef.current?.createInternal()
    }))

    const handleCreate = useCallback(
      ({
        parentId,
        type
      }: {
        parentId: string | null
        index: number
        type: 'internal' | 'leaf'
      }): { id: string } | null => {
        const parentPath = parentId ? parentId.replace(/^folder:/, '') : undefined

        if (type === 'internal') {
          const folderPath = addFolder(parentPath)
          const folderId = `folder:${folderPath}`
          markAsJustCreated(folderId)
          return { id: folderId }
        }

        const relativePath = addNote(parentPath)
        storeApi.getState().openTab(relativePath)
        markAsJustCreated(relativePath)
        return { id: relativePath }
      },
      [addNote, addFolder, storeApi]
    )

    const handleRename = useCallback(
      ({ id, name }: { id: string; name: string }) => {
        if (!name.trim()) return

        if (id.startsWith('folder:')) {
          const oldPath = id.replace(/^folder:/, '')
          renameFolder(oldPath, name)
        } else {
          renameNote(id, name)
        }
      },
      [renameNote, renameFolder]
    )

    const renderRow = useCallback(
      (props: {
        node: import('react-arborist').NodeApi<NoteTreeNode>
        attrs: Record<string, unknown>
        innerRef: React.Ref<HTMLDivElement>
        children: React.ReactNode
      }) => (
        <div ref={props.innerRef} {...props.attrs}>
          {props.children}
        </div>
      ),
      []
    )

    return (
      <Tree<NoteTreeNode>
        ref={treeRef}
        data={tree}
        openByDefault={true}
        width="100%"
        height={height}
        rowHeight={28}
        indent={20}
        renderRow={renderRow}
        onCreate={handleCreate}
        onRename={handleRename}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dndManager={dndManager as any}
      >
        {TreeNodeRenderer}
      </Tree>
    )
  }
)
