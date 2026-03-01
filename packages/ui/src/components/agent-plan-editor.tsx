import * as React from 'react'

import { Button } from './button'

type AgentPlanEditorProps = {
  rowId: string
  value?: string
  onSave: (rowId: string, planText: string) => void
}

function AgentPlanEditor({ rowId, value, onSave }: AgentPlanEditorProps): React.JSX.Element {
  const [draft, setDraft] = React.useState(value ?? '')

  React.useEffect(() => {
    setDraft(value ?? '')
  }, [value, rowId])

  const isDirty = draft !== (value ?? '')

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold">Plan</h4>
        <Button
          type="button"
          size="sm"
          className="shadow-none"
          disabled={!isDirty}
          onClick={() => {
            onSave(rowId, draft.trim())
          }}
        >
          Save plan
        </Button>
      </div>

      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        rows={4}
        className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
        placeholder="Document the next plan or execution steps..."
      />
    </section>
  )
}

export { AgentPlanEditor, type AgentPlanEditorProps }
