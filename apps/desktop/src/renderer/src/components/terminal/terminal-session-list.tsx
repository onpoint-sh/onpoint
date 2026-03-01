import type { CSSProperties } from 'react'
import { Columns2, Trash2 } from 'lucide-react'
import type { TerminalSessionId } from '@onpoint/shared/terminal'
import { useTerminalStore } from '@/stores/terminal-store'

type TerminalSessionListProps = {
  tabId: string
}

function getSessionLabel(
  sessionId: TerminalSessionId,
  sessionsById: ReturnType<typeof useTerminalStore.getState>['sessionsById']
): string {
  const session = sessionsById[sessionId]
  if (!session) return 'Terminal'

  if (session.title && session.title.trim().length > 0) {
    return session.title.trim()
  }

  if (session.name && session.name.trim().length > 0) {
    return session.name.trim()
  }

  const shellParts = session.shellPath.split(/[\\/]/)
  return shellParts[shellParts.length - 1] || 'Terminal'
}

function getSessionStatus(
  sessionId: TerminalSessionId,
  sessionsById: ReturnType<typeof useTerminalStore.getState>['sessionsById']
): string | null {
  const session = sessionsById[sessionId]
  if (!session) return 'Unavailable'
  if (!session.exited) return null

  if (typeof session.exitCode === 'number') {
    return `Exited (${session.exitCode})`
  }

  return 'Exited'
}

type SessionTreeItem = ReturnType<
  ReturnType<typeof useTerminalStore.getState>['getSessionTreeForBottomPanelTab']
>[number]

function renderBranchGlyph(item: SessionTreeItem): string {
  if (item.branch === 'root') return 'o'
  return item.branch === 'first' ? '├' : '└'
}

function TerminalSessionList({ tabId }: TerminalSessionListProps): React.JSX.Element {
  const groupByBottomPanelTabId = useTerminalStore((state) => state.groupByBottomPanelTabId)
  const groupsById = useTerminalStore((state) => state.groupsById)
  const sessionsById = useTerminalStore((state) => state.sessionsById)

  const splitSessionInGroup = useTerminalStore((state) => state.splitSessionInGroup)
  const setActiveSessionInGroup = useTerminalStore((state) => state.setActiveSessionInGroup)
  const killSessionInGroup = useTerminalStore((state) => state.killSessionInGroup)
  const getSessionTreeForBottomPanelTab = useTerminalStore(
    (state) => state.getSessionTreeForBottomPanelTab
  )

  const groupId = groupByBottomPanelTabId[tabId] ?? null
  const group = groupId ? (groupsById[groupId] ?? null) : null
  const items = getSessionTreeForBottomPanelTab(tabId)

  const activeSessionId = group?.activeSessionId ?? null

  return (
    <aside className="terminal-session-list">
      <div className="terminal-session-list-body">
        {items.length === 0 ? (
          <div className="terminal-session-list-empty">No active sessions</div>
        ) : (
          items.map((item) => {
            const status = getSessionStatus(item.sessionId, sessionsById)
            const isActive = item.sessionId === activeSessionId
            const rowStyle = {
              paddingLeft: `${item.depth * 16 + 8}px`,
              '--terminal-tree-depth': String(item.depth)
            } as CSSProperties & Record<'--terminal-tree-depth', string>

            return (
              <div
                key={item.sessionId}
                className={`terminal-session-row ${item.depth > 0 ? 'terminal-session-row--split' : 'terminal-session-row--root'}`}
                data-active={isActive ? 'true' : undefined}
                data-depth={item.depth}
                data-branch={item.branch}
                style={rowStyle}
                onClick={() => {
                  setActiveSessionInGroup(tabId, item.sessionId)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveSessionInGroup(tabId, item.sessionId)
                  }
                }}
              >
                <span className="terminal-session-branch">{renderBranchGlyph(item)}</span>
                <span
                  className="terminal-session-label"
                  title={getSessionLabel(item.sessionId, sessionsById)}
                >
                  {getSessionLabel(item.sessionId, sessionsById)}
                </span>
                {status ? <span className="terminal-session-badge">{status}</span> : null}
                <div className="terminal-session-actions">
                  <button
                    type="button"
                    className="terminal-session-action"
                    title="Split right"
                    aria-label="Split right"
                    onClick={(event) => {
                      event.stopPropagation()
                      void splitSessionInGroup(tabId, item.sessionId, 'row')
                    }}
                  >
                    <Columns2 className="size-3" />
                  </button>
                  <button
                    type="button"
                    className="terminal-session-action"
                    title="Split down"
                    aria-label="Split down"
                    onClick={(event) => {
                      event.stopPropagation()
                      void splitSessionInGroup(tabId, item.sessionId, 'column')
                    }}
                  >
                    <Columns2 className="size-3 terminal-session-action-rotated" />
                  </button>
                  <button
                    type="button"
                    className="terminal-session-action"
                    title="Kill session"
                    aria-label="Kill session"
                    onClick={(event) => {
                      event.stopPropagation()
                      void killSessionInGroup(tabId, item.sessionId)
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

export { TerminalSessionList }
export type { TerminalSessionListProps }
