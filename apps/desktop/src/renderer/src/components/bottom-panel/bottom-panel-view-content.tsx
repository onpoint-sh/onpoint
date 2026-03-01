import type { BottomPanelViewId } from '@/bottom-panel/view-definitions'

type BottomPanelViewContentProps = {
  viewId: BottomPanelViewId
}

function BottomPanelViewContent({ viewId }: BottomPanelViewContentProps): React.JSX.Element {
  if (viewId === 'terminal') {
    return (
      <div className="bottom-panel-empty-state">
        <h3 className="bottom-panel-empty-title">Terminal</h3>
        <p className="bottom-panel-empty-description">
          Shell sessions will render here. The panel model already supports tab/pane state.
        </p>
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
