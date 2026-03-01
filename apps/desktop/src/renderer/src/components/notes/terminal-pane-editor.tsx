import { useEffect } from 'react'
import { XtermHost } from '@/components/terminal/xterm-host'
import { getTerminalEditorId, isTerminalEditorPath } from '@/lib/terminal-editor-tab'
import { usePanesStore } from '@/stores/panes-store'
import { useTerminalStore } from '@/stores/terminal-store'

type TerminalPaneEditorProps = {
  tabId?: string
  relativePath: string | null
}

function TerminalPaneEditor({ tabId, relativePath }: TerminalPaneEditorProps): React.JSX.Element {
  const initialize = useTerminalStore((state) => state.initialize)
  const ensureSessionForEditorPath = useTerminalStore((state) => state.ensureSessionForEditorPath)
  const mappedSessionId = useTerminalStore((state) =>
    relativePath ? (state.sessionByEditorPath[relativePath] ?? null) : null
  )
  const parsedSessionId =
    relativePath && isTerminalEditorPath(relativePath) ? getTerminalEditorId(relativePath) : ''
  const sessionId = mappedSessionId || parsedSessionId || null
  const session = useTerminalStore((state) =>
    sessionId ? (state.sessionsById[sessionId] ?? null) : null
  )

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (!relativePath || (sessionId && session)) return
    let cancelled = false
    void (async () => {
      const resolved = await ensureSessionForEditorPath(relativePath)
      if (cancelled) return

      if (resolved.path !== relativePath && tabId) {
        usePanesStore.getState().updateTabPath(relativePath, resolved.path)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ensureSessionForEditorPath, relativePath, session, sessionId, tabId])

  if (!sessionId || !session) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="bottom-panel-empty-state">
          <h3 className="bottom-panel-empty-title">Terminal</h3>
          <p className="bottom-panel-empty-description">Starting shell session...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <XtermHost sessionId={sessionId} autoFocus />
    </section>
  )
}

export { TerminalPaneEditor }
export type { TerminalPaneEditorProps }
