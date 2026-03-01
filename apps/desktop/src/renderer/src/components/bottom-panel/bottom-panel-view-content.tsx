import type { BottomPanelViewId } from '@/bottom-panel/view-definitions'
import { useEffect } from 'react'
import { TerminalPanelWorkspace } from '@/components/terminal/terminal-panel-workspace'
import { useBottomPanelStore } from '@/stores/bottom-panel-store'
import { useTerminalStore } from '@/stores/terminal-store'

type BottomPanelViewContentProps = {
  viewId: BottomPanelViewId
  tabId: string | null
}

function BottomPanelViewContent({ viewId, tabId }: BottomPanelViewContentProps): React.JSX.Element {
  const initialize = useTerminalStore((state) => state.initialize)
  const ensureGroupForBottomPanelTab = useTerminalStore(
    (state) => state.ensureGroupForBottomPanelTab
  )
  const panelFocusRequestId = useBottomPanelStore((state) => state.focusRequestId)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (viewId !== 'terminal' || !tabId) return
    void ensureGroupForBottomPanelTab(tabId)
  }, [ensureGroupForBottomPanelTab, tabId, viewId])

  if (viewId === 'terminal') {
    if (!tabId) {
      return (
        <div className="bottom-panel-empty-state">
          <h3 className="bottom-panel-empty-title">Terminal</h3>
          <p className="bottom-panel-empty-description">Terminal tab metadata is unavailable.</p>
        </div>
      )
    }

    return (
      <div className="bottom-panel-terminal-container">
        <TerminalPanelWorkspace tabId={tabId} panelFocusRequestId={panelFocusRequestId} />
      </div>
    )
  }

  if (viewId === 'problems') {
    return (
      <div className="bottom-panel-empty-state">
        <h3 className="bottom-panel-empty-title">Problems</h3>
        <p className="bottom-panel-empty-description">
          Diagnostics output can be attached to this view without changing panel navigation logic.
        </p>
      </div>
    )
  }

  return (
    <div className="bottom-panel-empty-state">
      <h3 className="bottom-panel-empty-title">Output</h3>
      <p className="bottom-panel-empty-description">
        Runtime logs and command output streams can mount here as independent providers.
      </p>
    </div>
  )
}

export { BottomPanelViewContent }
export type { BottomPanelViewContentProps }
