import { useCallback, useEffect } from 'react'
import { useDragDropManager } from 'react-dnd'
import { Mosaic, type MosaicNode } from 'react-mosaic-component'
import type { TerminalSessionId } from '@onpoint/shared/terminal'
import { useTerminalStore } from '@/stores/terminal-store'
import { XtermHost } from './xterm-host'
import { TerminalSessionList } from './terminal-session-list'

type TerminalPanelWorkspaceProps = {
  tabId: string
  panelFocusRequestId?: number
}

function TerminalPanelWorkspace({
  tabId,
  panelFocusRequestId = 0
}: TerminalPanelWorkspaceProps): React.JSX.Element {
  const ensureGroupForBottomPanelTab = useTerminalStore(
    (state) => state.ensureGroupForBottomPanelTab
  )
  const createSessionInGroup = useTerminalStore((state) => state.createSessionInGroup)
  const setActiveSessionInGroup = useTerminalStore((state) => state.setActiveSessionInGroup)
  const updateGroupLayout = useTerminalStore((state) => state.updateGroupLayout)
  const groupByBottomPanelTabId = useTerminalStore((state) => state.groupByBottomPanelTabId)
  const groupsById = useTerminalStore((state) => state.groupsById)

  const dndManager = useDragDropManager()

  useEffect(() => {
    void ensureGroupForBottomPanelTab(tabId)
  }, [ensureGroupForBottomPanelTab, tabId])

  const groupId = groupByBottomPanelTabId[tabId] ?? null
  const group = groupId ? (groupsById[groupId] ?? null) : null
  const activeSessionId = group?.activeSessionId ?? null
  const layout = group?.layout ?? null

  const renderTile = useCallback(
    (sessionId: TerminalSessionId): React.JSX.Element => {
      const isActive = activeSessionId === sessionId

      return (
        <section
          className="terminal-panel-leaf"
          data-active={isActive ? 'true' : undefined}
          onMouseDownCapture={() => {
            setActiveSessionInGroup(tabId, sessionId)
          }}
        >
          <div className="terminal-panel-leaf-body">
            <XtermHost
              sessionId={sessionId}
              autoFocus={isActive}
              focusRequestToken={isActive ? panelFocusRequestId : 0}
            />
          </div>
        </section>
      )
    },
    [activeSessionId, panelFocusRequestId, setActiveSessionInGroup, tabId]
  )

  return (
    <div className="terminal-panel-workspace-root">
      <div className="terminal-panel-workspace-main mosaic-container">
        {layout ? (
          <Mosaic<TerminalSessionId>
            renderTile={renderTile}
            value={layout}
            onChange={(nextLayout: MosaicNode<TerminalSessionId> | null) => {
              updateGroupLayout(tabId, nextLayout)
            }}
            dragAndDropManager={dndManager}
          />
        ) : (
          <div className="terminal-panel-workspace-empty">
            <p className="terminal-panel-workspace-empty-copy">No active sessions in this tab.</p>
            <button
              type="button"
              className="terminal-panel-workspace-empty-btn"
              onClick={() => {
                void createSessionInGroup(tabId)
              }}
            >
              Create Session
            </button>
          </div>
        )}
      </div>

      <TerminalSessionList tabId={tabId} />
    </div>
  )
}

export { TerminalPanelWorkspace }
export type { TerminalPanelWorkspaceProps }
