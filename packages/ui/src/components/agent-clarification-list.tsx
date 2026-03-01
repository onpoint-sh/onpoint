import * as React from 'react'

import { Button } from './button'
import { cn } from '../lib/utils'

type ClarificationOption = {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

type ClarificationItem = {
  id: string
  prompt: string
  options?: ClarificationOption[]
  answer?: string
  state: 'open' | 'answered' | 'dismissed'
  createdAt: string
  answeredAt?: string
}

type AgentClarificationListProps = {
  rowId: string
  clarifications: ClarificationItem[]
  onAnswer: (rowId: string, itemId: string, answer: string) => void
}

function AgentClarificationList({
  rowId,
  clarifications,
  onAnswer
}: AgentClarificationListProps): React.JSX.Element {
  const [draftById, setDraftById] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    setDraftById((current) => {
      const next: Record<string, string> = {}
      for (const clarification of clarifications) {
        next[clarification.id] = current[clarification.id] ?? clarification.answer ?? ''
      }
      return next
    })
  }, [clarifications])

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold">Clarifications</h4>
        <span className="text-xs text-muted-foreground">{clarifications.length} total</span>
      </div>

      {clarifications.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No clarifications on this row.
        </div>
      ) : (
        <div className="space-y-3">
          {clarifications.map((item) => {
            const currentDraft = draftById[item.id] ?? ''
            const isOpen = item.state === 'open'

            return (
              <div key={item.id} className="rounded-md border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="m-0 text-sm font-medium">{item.prompt}</p>
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[0.7rem] uppercase tracking-wide',
                      item.state === 'open'
                        ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                        : item.state === 'answered'
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'border-border bg-muted text-muted-foreground'
                    )}
                  >
                    {item.state}
                  </span>
                </div>

                {item.options && item.options.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {item.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!isOpen}
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-1 text-xs',
                          currentDraft === option.label
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-foreground'
                        )}
                        onClick={() => {
                          setDraftById((current) => ({
                            ...current,
                            [item.id]: option.label
                          }))
                        }}
                      >
                        {option.label}
                        {option.recommended ? (
                          <span className="ml-1 text-[0.65rem] text-muted-foreground">
                            (Recommended)
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <textarea
                    value={currentDraft}
                    disabled={!isOpen}
                    onChange={(event) => {
                      setDraftById((current) => ({
                        ...current,
                        [item.id]: event.target.value
                      }))
                    }}
                    rows={2}
                    className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Write answer..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[0.72rem] text-muted-foreground">
                      {item.answeredAt
                        ? `Answered at ${new Date(item.answeredAt).toLocaleString()}`
                        : `Created at ${new Date(item.createdAt).toLocaleString()}`}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="shadow-none"
                      disabled={!isOpen || currentDraft.trim().length === 0}
                      onClick={() => {
                        onAnswer(rowId, item.id, currentDraft.trim())
                      }}
                    >
                      Submit answer
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export {
  AgentClarificationList,
  type ClarificationItem,
  type ClarificationOption,
  type AgentClarificationListProps
}
