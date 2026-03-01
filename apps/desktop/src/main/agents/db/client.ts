import { app } from 'electron'
import Database from 'better-sqlite3'
import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

type AgentsDbContext = {
  sqlite: BetterSqliteDatabase
  db: BetterSQLite3Database<typeof schema>
}

type SqlMigration = {
  id: number
  name: string
  sql: string
}

const FALLBACK_MIGRATIONS: SqlMigration[] = [
  {
    id: 1,
    name: '0001_init',
    sql: `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_text TEXT,
  metrics_label TEXT,
  clarifications_json TEXT NOT NULL,
  activity_json TEXT NOT NULL,
  awaiting_note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);`
  },
  {
    id: 2,
    name: '0002_archive',
    sql: `
ALTER TABLE agents ADD COLUMN archived_at_ms INTEGER;`
  }
]

const dbByWindowId = new Map<string, AgentsDbContext>()

function getAgentsDbPath(windowId: string): string {
  if (windowId === 'main') {
    return join(app.getPath('userData'), 'agents.v1.sqlite')
  }
  return join(app.getPath('userData'), `agents.${windowId}.v1.sqlite`)
}

function loadMigrationSql(migration: SqlMigration): string {
  const migrationPath = join(__dirname, 'migrations', `${migration.name}.sql`)
  if (!existsSync(migrationPath)) {
    return migration.sql
  }

  try {
    return readFileSync(migrationPath, 'utf-8')
  } catch {
    return migration.sql
  }
}

function runMigrations(sqlite: BetterSqliteDatabase): void {
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS __agents_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at_ms INTEGER NOT NULL
);`)

  const appliedRows = sqlite
    .prepare<[], { id: number }>('SELECT id FROM __agents_migrations ORDER BY id ASC')
    .all()
  const applied = new Set(appliedRows.map((row) => row.id))

  const pending = FALLBACK_MIGRATIONS.filter((migration) => !applied.has(migration.id))
  if (pending.length === 0) return

  const insertStmt = sqlite.prepare<[number, string, number]>(
    'INSERT INTO __agents_migrations (id, name, applied_at_ms) VALUES (?, ?, ?)'
  )
  const applyAll = sqlite.transaction((migrations: SqlMigration[]) => {
    const now = Date.now()
    for (const migration of migrations) {
      sqlite.exec(loadMigrationSql(migration))
      insertStmt.run(migration.id, migration.name, now)
    }
  })

  applyAll(pending)
}

function createAgentsDbContext(windowId: string): AgentsDbContext {
  const filePath = getAgentsDbPath(windowId)
  const fileDir = dirname(filePath)
  if (!existsSync(fileDir)) {
    mkdirSync(fileDir, { recursive: true })
  }

  const sqlite = new Database(filePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  runMigrations(sqlite)

  return {
    sqlite,
    db: drizzle(sqlite, { schema })
  }
}

export function getAgentsDb(windowId: string): AgentsDbContext {
  const existing = dbByWindowId.get(windowId)
  if (existing) return existing

  const created = createAgentsDbContext(windowId)
  dbByWindowId.set(windowId, created)
  return created
}

export function closeAgentsDb(windowId: string): void {
  const existing = dbByWindowId.get(windowId)
  if (!existing) return
  if (existing.sqlite.open) {
    existing.sqlite.close()
  }
  dbByWindowId.delete(windowId)
}

export function closeAllAgentsDbs(): void {
  for (const windowId of dbByWindowId.keys()) {
    closeAgentsDb(windowId)
  }
}

export async function deleteAgentsDb(windowId: string): Promise<void> {
  if (windowId === 'main') return
  closeAgentsDb(windowId)

  const basePath = getAgentsDbPath(windowId)
  const sidecars = [basePath, `${basePath}-wal`, `${basePath}-shm`]
  for (const path of sidecars) {
    try {
      await fs.unlink(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to delete agents DB file ${path}`, error)
      }
    }
  }
}
