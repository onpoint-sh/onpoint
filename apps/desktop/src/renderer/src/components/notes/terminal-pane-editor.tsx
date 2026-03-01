import { createTerminalEditorPath, getTerminalEditorId } from '@/lib/terminal-editor-tab'

type TerminalPaneEditorProps = {
  relativePath: string | null
}

function TerminalPaneEditor({ relativePath }: TerminalPaneEditorProps): React.JSX.Element {
  const terminalId = relativePath ? getTerminalEditorId(relativePath) : ''

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="flex h-full flex-col gap-2 p-3">
        <h3 className="m-0 text-sm font-semibold">Terminal</h3>
        <p className="m-0 text-xs text-muted-foreground">
          Terminal tabs in the editor are scaffolded and ready for session binding.
        </p>
        <code className="rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
          {terminalId || createTerminalEditorPath('session').replace('terminal://', '')}
        </code>
      </div>
    </section>
  )
}

export { TerminalPaneEditor }
export type { TerminalPaneEditorProps }
