import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentRecord } from '@onpoint/shared/agents'
import { AgentsTable, type AgentsTableProps } from '@onpoint/ui'
import { SplitAddButton } from '@/components/common/split-add-button'
import { ConfirmDialog } from '@/components/notes/pane-tab-bar'
import { useAgentsStore } from '@/stores/agents-store'

function formatAgeLabel(timestampMs: number): string {
  const diffMs = Math.max(0, Date.now() - timestampMs)
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function AgentsWorkspace(): React.JSX.Element {
  const [pendingDeleteAgentId, setPendingDeleteAgentId] = useState<string | null>(null)
  const records = useAgentsStore((state) => state.records)
  const isLoading = useAgentsStore((state) => state.isLoading)
  const error = useAgentsStore((state) => state.error)
  const loadAgents = useAgentsStore((state) => state.loadAgents)
  const addAgent = useAgentsStore((state) => state.addAgent)
  const archiveAgent = useAgentsStore((state) => state.archiveAgent)
  const deleteAgent = useAgentsStore((state) => state.deleteAgent)
  const updatePlan = useAgentsStore((state) => state.updatePlan)
  const setStatus = useAgentsStore((state) => state.setStatus)
  const answerClarification = useAgentsStore((state) => state.answerClarification)

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteAgentId) return
    void deleteAgent(pendingDeleteAgentId)
    setPendingDeleteAgentId(null)
  }, [deleteAgent, pendingDeleteAgentId])

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteAgentId(null)
  }, [])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  const columns = useMemo<AgentsTableProps<AgentRecord>['columns']>(
    () => [
      {
        accessorKey: 'title',
        header: 'Agent Task',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{row.original.title}</span>
          </div>
        )
      }
    ],
    []
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-background">
      <div className="mx-auto flex w-full max-w-[1024px] flex-1 min-h-0 flex-col px-5 py-5">
        {isLoading ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Loading agents workspace...
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <AgentsTable<AgentRecord>
            data={records}
            columns={columns}
            getRowId={(row) => row.id}
            getMeta={(row) => ({
              status: row.status,
              pendingCount: row.clarifications.filter((item) => item.state === 'open').length,
              ageLabel: formatAgeLabel(row.updatedAtMs),
              planText: row.planText ?? '',
              clarifications: row.clarifications,
              metricsLabel: row.metricsLabel ?? undefined,
              awaitingNote: row.awaitingNote ?? '',
              activity: row.activity
            })}
            onAddRow={() => void addAgent()}
            addControl={
              <SplitAddButton
                groupLabel="Add row"
                primaryLabel="Add row"
                secondaryLabel="More add options"
                onPrimaryClick={() => {
                  void addAgent()
                }}
                onSecondaryClick={() => {
                  void addAgent()
                }}
              />
            }
            onUpdatePlan={(rowId, planText) => {
              void updatePlan({ id: rowId, planText })
            }}
            onClarificationAnswer={(rowId, itemId, answer) => {
              void answerClarification({ id: rowId, clarificationId: itemId, answer })
            }}
            onSetStatus={(rowId, status, options) => {
              void setStatus({
                id: rowId,
                status,
                note: options?.note,
                awaitingNote: options?.awaitingNote
              })
            }}
            onArchiveRow={(rowId) => {
              void archiveAgent(rowId)
            }}
            onDeleteRow={(rowId) => {
              setPendingDeleteAgentId(rowId)
            }}
          />
        </div>
      </div>
      {pendingDeleteAgentId ? (
        <ConfirmDialog
          title="Delete this agent permanently?"
          description="This action cannot be undone."
          actions={[
            { label: 'Delete', onClick: handleConfirmDelete, variant: 'primary' },
            { label: 'Cancel', onClick: handleCancelDelete, variant: 'secondary' }
          ]}
          onOverlayClick={handleCancelDelete}
        />
      ) : null}
    </div>
  )
}

export { AgentsWorkspace }
