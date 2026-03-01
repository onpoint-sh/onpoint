import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const agentsTable = sqliteTable('agents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  planText: text('plan_text'),
  metricsLabel: text('metrics_label'),
  clarificationsJson: text('clarifications_json').notNull(),
  activityJson: text('activity_json').notNull(),
  awaitingNote: text('awaiting_note'),
  archivedAtMs: integer('archived_at_ms'),
  createdAtMs: integer('created_at_ms').notNull(),
  updatedAtMs: integer('updated_at_ms').notNull()
})

export { agentsTable }
