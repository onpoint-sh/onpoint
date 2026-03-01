import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row
} from '@tanstack/react-table'

import type { AgentStatus } from '../lib/agent-status'
import { Button } from './button'
import type { ClarificationItem } from './agent-clarification-list'
import { AgentStatusChip } from './agent-status-chip'

type AgentActivityItem = {
  id: string
  timestamp: string
  message: string
}

type AgentRowMeta = {
  status: AgentStatus
  pendingCount: number
  ageLabel: string
  planText?: string
  clarifications: ClarificationItem[]
  metricsLabel?: string
  awaitingNote?: string | null
  activity?: AgentActivityItem[]
}

type AgentsTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData>[]
  getRowId: (row: TData) => string
  getMeta: (row: TData) => AgentRowMeta
  onAddRow: () => void
  onUpdatePlan: (rowId: string, planText: string) => void
  onClarificationAnswer: (rowId: string, itemId: string, answer: string) => void
  onSetStatus: (
    rowId: string,
    status: AgentStatus,
    options?: { note?: string; awaitingNote?: string | null }
  ) => void
  onArchiveRow?: (rowId: string) => void
  onDeleteRow?: (rowId: string) => void
  onRowClick?: (row: TData) => void
  addControl?: React.ReactNode
}

type ContextMenuItem = {
  id: string
  label: string
}

type ContextMenuBridge = {
  show: (items: ContextMenuItem[]) => Promise<string | null>
}

function getContextMenuBridge(): ContextMenuBridge | null {
  if (typeof window === 'undefined') return null
  const maybeWindow = window as Window & { contextMenu?: ContextMenuBridge }
  return maybeWindow.contextMenu ?? null
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function MoreHorizontalIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function AgentsTable<TData>({
  data,
  columns,
  getRowId,
  getMeta,
  onAddRow,
  onArchiveRow,
  onDeleteRow,
  onRowClick,
  addControl
}: AgentsTableProps<TData>): React.JSX.Element {
  const rowPaddingInline = '1rem'
  const [expandedByRowId, setExpandedByRowId] = React.useState<Record<string, boolean>>({})
  const previousRowIdsRef = React.useRef<string[]>([])
  const hasInitializedRowIdsRef = React.useRef(false)

  const rowMetaById = React.useMemo(() => {
    const result = new Map<string, AgentRowMeta>()
    for (const row of data) {
      result.set(getRowId(row), getMeta(row))
    }
    return result
  }, [data, getMeta, getRowId])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (originalRow) => getRowId(originalRow)
  })

  const toggleRow = React.useCallback((rowId: string) => {
    setExpandedByRowId((current) => ({
      ...current,
      [rowId]: !current[rowId]
    }))
  }, [])

  React.useEffect(() => {
    const rowIds = data.map((row) => getRowId(row))

    if (!hasInitializedRowIdsRef.current) {
      hasInitializedRowIdsRef.current = true
      previousRowIdsRef.current = rowIds
      return
    }

    const previousIds = new Set(previousRowIdsRef.current)
    const newRowId = rowIds.find((rowId) => !previousIds.has(rowId))

    if (newRowId) {
      setExpandedByRowId((current) => ({
        ...current,
        [newRowId]: true
      }))
    }

    previousRowIdsRef.current = rowIds
  }, [data, getRowId])

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 pb-2">
        <h3 className="m-0 text-base font-semibold">Agents</h3>
        {addControl ?? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shadow-none"
            onClick={onAddRow}
          >
            Add row
          </Button>
        )}
      </div>

      <div
        className="overflow-hidden border border-border/80 bg-background rounded-[0.9rem]"
        style={{ borderRadius: '0.9rem' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const meta = rowMetaById.get(row.id)
                const isExpanded = Boolean(expandedByRowId[row.id])
                const visibleCells = row.getVisibleCells()
                const pendingCount =
                  meta?.pendingCount ??
                  meta?.clarifications.filter((clarification) => clarification.state === 'open')
                    .length ??
                  0

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      className="group/agent-row cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      onClick={() => {
                        toggleRow(row.id)
                        onRowClick?.(row.original)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleRow(row.id)
                          onRowClick?.(row.original)
                        }
                      }}
                    >
                      <td
                        colSpan={Math.max(
                          visibleCells.length,
                          table.getVisibleLeafColumns().length,
                          1
                        )}
                        className="py-3 align-middle"
                        style={{ paddingInline: rowPaddingInline }}
                      >
                        <div className="flex min-h-12 items-center justify-between gap-5">
                          <div className="min-w-0 truncate">
                            {visibleCells[0]
                              ? flexRender(
                                  visibleCells[0].column.columnDef.cell,
                                  visibleCells[0].getContext()
                                )
                              : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            {meta ? (
                              <>
                                <AgentStatusChip status={meta.status} />
                                <span>{pendingCount} open</span>
                                <span aria-hidden="true" className="text-border">
                                  ·
                                </span>
                                <span className="tabular-nums">{meta.ageLabel}</span>
                                {meta.metricsLabel ? (
                                  <>
                                    <span aria-hidden="true" className="text-border">
                                      ·
                                    </span>
                                    <span>{meta.metricsLabel}</span>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                            <ChevronRightIcon
                              className={`size-3.5 text-muted-foreground transition-transform ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                            {onArchiveRow || onDeleteRow ? (
                              <button
                                type="button"
                                className="inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-[opacity,background-color,color] hover:bg-muted/60 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 group-hover/agent-row:opacity-100"
                                aria-label="Row actions"
                                onMouseDown={(event) => {
                                  event.stopPropagation()
                                }}
                                onClick={async (event) => {
                                  event.preventDefault()
                                  event.stopPropagation()

                                  const contextMenu = getContextMenuBridge()
                                  if (!contextMenu) return

                                  const menuItems: ContextMenuItem[] = []
                                  if (onArchiveRow) {
                                    menuItems.push({ id: 'archive', label: 'Archive' })
                                  }
                                  if (onDeleteRow) {
                                    menuItems.push({ id: 'delete', label: 'Delete' })
                                  }
                                  if (menuItems.length === 0) return

                                  const clickedId = await contextMenu.show(menuItems)
                                  if (!clickedId) return
                                  if (clickedId === 'archive') onArchiveRow?.(row.id)
                                  if (clickedId === 'delete') onDeleteRow?.(row.id)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.stopPropagation()
                                  }
                                }}
                              >
                                <MoreHorizontalIcon className="size-4" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="border-b border-border/70">
                        <td
                          colSpan={Math.max(
                            visibleCells.length,
                            table.getVisibleLeafColumns().length,
                            1
                          )}
                          className="py-0 text-sm text-muted-foreground"
                          style={{ paddingInline: 0 }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="min-h-64 flex flex-col">
                            <label htmlFor={`agent-follow-up-${row.id}`} className="sr-only">
                              Agent follow-up input
                            </label>
                            <textarea
                              id={`agent-follow-up-${row.id}`}
                              autoFocus
                              rows={4}
                              className="block min-h-24 w-full flex-1 resize-none border-0 bg-transparent px-6 pt-6 text-[1.05rem] leading-7 outline-none focus-visible:ring-0"
                            />

                            <div className="mt-auto flex items-center justify-between gap-4 px-5 pb-4 pt-2 text-muted-foreground">
                              <div className="flex min-w-0 items-center gap-4 text-[0.82rem] font-medium sm:text-sm">
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted/70"
                                  aria-label="Add attachment"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="size-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors hover:bg-muted/60"
                                >
                                  <span className="truncate">GPT-5.3-Codex</span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="size-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="m6 9 6 6 6-6" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors hover:bg-muted/60"
                                >
                                  <span>High</span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="size-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="m6 9 6 6 6-6" />
                                  </svg>
                                </button>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted/70"
                                  aria-label="Voice input"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="size-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 15a3 3 0 0 0 3-3V8a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
                                    <path d="M19 12a7 7 0 0 1-14 0" />
                                    <path d="M12 19v3" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
                                  aria-label="Send"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="size-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 19V5" />
                                    <path d="m5 12 7-7 7 7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })}

              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
                    className="py-6"
                    style={{ paddingInline: rowPaddingInline }}
                  >
                    <p className="m-0 text-center text-sm text-muted-foreground">No agents yet.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export {
  AgentsTable,
  type AgentActivityItem,
  type AgentRowMeta,
  type AgentsTableProps,
  type AgentStatus,
  type ClarificationItem,
  type Row
}
