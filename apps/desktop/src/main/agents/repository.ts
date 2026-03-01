import { desc, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import {
  type AgentArchiveInput,
  type AgentAnswerClarificationInput,
  type AgentActivityItem,
  type AgentClarification,
  type AgentCreateInput,
  type AgentDeleteInput,
  type AgentRecord,
  type AgentSetStatusInput,
  type AgentStatus,
  type AgentUpdatePlanInput
} from '@onpoint/shared/agents'
import { getAgentsDb } from './db/client'
import { agentsTable } from './db/schema'

const VALID_STATUSES: readonly AgentStatus[] = [
  'planned',
  'needs_clarification',
  'awaiting_response',
  'in_progress',
  'done'
]

type AgentRow = typeof agentsTable.$inferSelect

function isAgentStatus(value: string): value is AgentStatus {
  return VALID_STATUSES.includes(value as AgentStatus)
}

function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

function appendActivity(items: AgentActivityItem[], message: string): AgentActivityItem[] {
  return [
    ...items,
    {
      id: `activity-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      message
    }
  ]
}

function rowToRecord(row: AgentRow): AgentRecord {
  const status = isAgentStatus(row.status) ? row.status : 'planned'

  return {
    id: row.id,
    title: row.title,
    status,
    planText: row.planText,
    metricsLabel: row.metricsLabel,
    clarifications: parseJsonArray<AgentClarification>(row.clarificationsJson, []),
    activity: parseJsonArray<AgentActivityItem>(row.activityJson, []),
    awaitingNote: row.awaitingNote,
    archivedAtMs: row.archivedAtMs,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs
  }
}

function serializeRecordParts(record: {
  clarifications: AgentClarification[]
  activity: AgentActivityItem[]
}): {
  clarificationsJson: string
  activityJson: string
} {
  return {
    clarificationsJson: JSON.stringify(record.clarifications),
    activityJson: JSON.stringify(record.activity)
  }
}

function getRecordById(windowId: string, id: string): AgentRecord {
  const { db } = getAgentsDb(windowId)
  const row = db.select().from(agentsTable).where(eq(agentsTable.id, id)).get()
  if (!row) {
    throw new Error('Agent not found.')
  }
  return rowToRecord(row)
}

function createDefaultClarifications(): AgentClarification[] {
  return [
    {
      id: `clar-${randomUUID()}`,
      prompt: 'What is the first clarification question to ask?',
      options: [
        {
          id: 'goal',
          label: 'Confirm goal',
          description: 'Clarify the intended end result.',
          recommended: true
        },
        {
          id: 'constraints',
          label: 'Check constraints',
          description: 'Confirm technical and product constraints.'
        }
      ],
      state: 'open',
      createdAt: new Date().toISOString()
    }
  ]
}

function createDefaultActivity(): AgentActivityItem[] {
  return [
    {
      id: `activity-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      message: 'Agent row created.'
    }
  ]
}

type AgentsRepository = {
  list: (windowId: string) => AgentRecord[]
  create: (windowId: string, input?: AgentCreateInput) => AgentRecord
  archive: (windowId: string, input: AgentArchiveInput) => AgentRecord
  delete: (windowId: string, input: AgentDeleteInput) => void
  updatePlan: (windowId: string, input: AgentUpdatePlanInput) => AgentRecord
  setStatus: (windowId: string, input: AgentSetStatusInput) => AgentRecord
  answerClarification: (windowId: string, input: AgentAnswerClarificationInput) => AgentRecord
}

export function createAgentsRepository(): AgentsRepository {
  return {
    list: (windowId) => {
      const { db } = getAgentsDb(windowId)
      return db
        .select()
        .from(agentsTable)
        .where(isNull(agentsTable.archivedAtMs))
        .orderBy(desc(agentsTable.updatedAtMs))
        .all()
        .map(rowToRecord)
    },

    create: (windowId, input) => {
      const { db } = getAgentsDb(windowId)
      const now = Date.now()
      const clarifications = createDefaultClarifications()
      const activity = createDefaultActivity()
      const serialized = serializeRecordParts({ clarifications, activity })

      const id = `agent-${randomUUID()}`
      db.insert(agentsTable)
        .values({
          id,
          title: input?.title?.trim() || 'Untitled agent task',
          status: 'planned',
          planText: '',
          metricsLabel: null,
          clarificationsJson: serialized.clarificationsJson,
          activityJson: serialized.activityJson,
          awaitingNote: null,
          archivedAtMs: null,
          createdAtMs: now,
          updatedAtMs: now
        })
        .run()

      return getRecordById(windowId, id)
    },

    archive: (windowId, input) => {
      const { db } = getAgentsDb(windowId)
      const current = getRecordById(windowId, input.id)
      if (current.archivedAtMs !== null) {
        throw new Error('Agent is already archived.')
      }

      const now = Date.now()
      const nextActivity = appendActivity(current.activity, 'Agent archived.')
      db.update(agentsTable)
        .set({
          archivedAtMs: now,
          activityJson: JSON.stringify(nextActivity),
          updatedAtMs: now
        })
        .where(eq(agentsTable.id, input.id))
        .run()

      return getRecordById(windowId, input.id)
    },

    delete: (windowId, input) => {
      const { db } = getAgentsDb(windowId)
      getRecordById(windowId, input.id)
      db.delete(agentsTable).where(eq(agentsTable.id, input.id)).run()
    },

    updatePlan: (windowId, input) => {
      const { db } = getAgentsDb(windowId)
      const current = getRecordById(windowId, input.id)
      const nextActivity = appendActivity(current.activity, 'Plan updated.')
      const serialized = serializeRecordParts({
        clarifications: current.clarifications,
        activity: nextActivity
      })

      db.update(agentsTable)
        .set({
          planText: input.planText,
          activityJson: serialized.activityJson,
          updatedAtMs: Date.now()
        })
        .where(eq(agentsTable.id, input.id))
        .run()

      return getRecordById(windowId, input.id)
    },

    setStatus: (windowId, input) => {
      const { db } = getAgentsDb(windowId)
      const current = getRecordById(windowId, input.id)

      const statusMessage =
        input.note && input.note.trim().length > 0
          ? `Status set to ${input.status}. ${input.note.trim()}`
          : `Status set to ${input.status}.`
      const nextActivity = appendActivity(current.activity, statusMessage)

      db.update(agentsTable)
        .set({
          status: input.status,
          awaitingNote:
            input.awaitingNote === undefined ? current.awaitingNote : (input.awaitingNote ?? null),
          activityJson: JSON.stringify(nextActivity),
          updatedAtMs: Date.now()
        })
        .where(eq(agentsTable.id, input.id))
        .run()

      return getRecordById(windowId, input.id)
    },

    answerClarification: (windowId, input) => {
      const { db } = getAgentsDb(windowId)
      const current = getRecordById(windowId, input.id)

      const answeredAt = new Date().toISOString()
      const nextClarifications = current.clarifications.map((item) => {
        if (item.id !== input.clarificationId) return item
        return {
          ...item,
          answer: input.answer,
          state: 'answered' as const,
          answeredAt
        }
      })

      const nextStatus = current.status === 'awaiting_response' ? 'in_progress' : current.status
      const statusMessage =
        nextStatus !== current.status
          ? [`Clarification answered.`, 'Status auto-transitioned to in_progress.'].join(' ')
          : 'Clarification answered.'
      const nextActivity = appendActivity(current.activity, statusMessage)

      const serialized = serializeRecordParts({
        clarifications: nextClarifications,
        activity: nextActivity
      })

      db.update(agentsTable)
        .set({
          clarificationsJson: serialized.clarificationsJson,
          activityJson: serialized.activityJson,
          status: nextStatus,
          updatedAtMs: Date.now()
        })
        .where(eq(agentsTable.id, input.id))
        .run()

      return getRecordById(windowId, input.id)
    }
  }
}
