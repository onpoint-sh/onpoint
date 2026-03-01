import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let userDataRoot = ''

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return userDataRoot
      return userDataRoot
    }
  }
}))

const require = createRequire(import.meta.url)
const supportsNativeSqlite = (() => {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
})()

const describeIfNativeSqlite = supportsNativeSqlite ? describe : describe.skip

describeIfNativeSqlite('agents repository', () => {
  let closeAllAgentsDbs: typeof import('./db/client').closeAllAgentsDbs
  let deleteAgentsDb: typeof import('./db/client').deleteAgentsDb
  let getAgentsDb: typeof import('./db/client').getAgentsDb
  let createAgentsRepository: typeof import('./repository').createAgentsRepository
  let agentsTable: typeof import('./db/schema').agentsTable

  beforeAll(async () => {
    const client = await import('./db/client')
    const repository = await import('./repository')
    const dbSchema = await import('./db/schema')
    closeAllAgentsDbs = client.closeAllAgentsDbs
    deleteAgentsDb = client.deleteAgentsDb
    getAgentsDb = client.getAgentsDb
    createAgentsRepository = repository.createAgentsRepository
    agentsTable = dbSchema.agentsTable
  })

  beforeEach(() => {
    userDataRoot = mkdtempSync(join(tmpdir(), 'onpoint-agents-test-'))
  })

  afterEach(() => {
    closeAllAgentsDbs()
    rmSync(userDataRoot, { recursive: true, force: true })
  })

  it('creates, updates, and lists agents', () => {
    const repository = createAgentsRepository()
    const created = repository.create('main', { title: 'Test agent row' })
    expect(created.title).toBe('Test agent row')
    expect(created.status).toBe('planned')
    expect(created.clarifications.length).toBeGreaterThan(0)
    expect(created.archivedAtMs).toBeNull()

    const planned = repository.updatePlan('main', {
      id: created.id,
      planText: 'Ship the feature in two steps.'
    })
    expect(planned.planText).toContain('two steps')

    const waiting = repository.setStatus('main', {
      id: created.id,
      status: 'awaiting_response',
      awaitingNote: 'Waiting for design feedback'
    })
    expect(waiting.status).toBe('awaiting_response')
    expect(waiting.awaitingNote).toContain('design')

    const clarification = waiting.clarifications[0]
    const progressed = repository.answerClarification('main', {
      id: created.id,
      clarificationId: clarification.id,
      answer: 'Confirmed with product.'
    })
    expect(progressed.status).toBe('in_progress')
    expect(progressed.clarifications[0].state).toBe('answered')

    const listed = repository.list('main')
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(created.id)
  })

  it('archives rows, excludes archived rows from list, and blocks duplicate archive', () => {
    const repository = createAgentsRepository()
    const created = repository.create('main', { title: 'Archive me' })

    const archived = repository.archive('main', { id: created.id })
    expect(archived.archivedAtMs).not.toBeNull()
    expect(repository.list('main')).toHaveLength(0)

    const { db } = getAgentsDb('main')
    const row = db.select().from(agentsTable).where(eq(agentsTable.id, created.id)).get()
    expect(row).toBeDefined()
    expect(row?.archivedAtMs).not.toBeNull()

    expect(() => repository.archive('main', { id: created.id })).toThrow('already archived')
  })

  it('deletes rows permanently', () => {
    const repository = createAgentsRepository()
    const created = repository.create('main', { title: 'Delete me' })
    repository.archive('main', { id: created.id })

    repository.delete('main', { id: created.id })

    const { db } = getAgentsDb('main')
    const row = db.select().from(agentsTable).where(eq(agentsTable.id, created.id)).get()
    expect(row).toBeUndefined()
    expect(repository.list('main')).toHaveLength(0)
  })

  it('isolates records by window id', () => {
    const repository = createAgentsRepository()
    repository.create('window-a', { title: 'A1' })
    repository.create('window-b', { title: 'B1' })

    const aItems = repository.list('window-a')
    const bItems = repository.list('window-b')

    expect(aItems).toHaveLength(1)
    expect(aItems[0].title).toBe('A1')
    expect(bItems).toHaveLength(1)
    expect(bItems[0].title).toBe('B1')
  })

  it('is safe to initialize and query repeatedly (idempotent migration bootstrap)', async () => {
    const repository = createAgentsRepository()
    expect(repository.list('main')).toHaveLength(0)
    repository.create('main', { title: 'Bootstrap check' })
    expect(repository.list('main')).toHaveLength(1)
    expect(repository.list('main')).toHaveLength(1)

    closeAllAgentsDbs()
    expect(repository.list('main')).toHaveLength(1)
    expect(existsSync(join(userDataRoot, 'agents.v1.sqlite'))).toBe(true)

    await deleteAgentsDb('main')
    expect(existsSync(join(userDataRoot, 'agents.v1.sqlite'))).toBe(true)
  })
})
