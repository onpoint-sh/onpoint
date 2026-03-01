import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  AGENTS_IPC_CHANNELS,
  type AgentArchiveInput,
  type AgentAnswerClarificationInput,
  type AgentCreateInput,
  type AgentDeleteInput,
  type AgentSetStatusInput,
  type AgentStatus,
  type AgentUpdatePlanInput
} from '@onpoint/shared/agents'
import { windowRegistry } from '../window/window-registry'
import { createAgentsRepository } from './repository'

const VALID_STATUSES: readonly AgentStatus[] = [
  'planned',
  'needs_clarification',
  'awaiting_response',
  'in_progress',
  'done'
]

function resolveWindowId(event: IpcMainInvokeEvent): string {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return 'main'
  return windowRegistry.getWindowId(window) ?? 'main'
}

function validateNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value
}

function validateStatus(value: unknown): AgentStatus {
  if (typeof value !== 'string' || !VALID_STATUSES.includes(value as AgentStatus)) {
    throw new Error('Invalid agent status.')
  }
  return value as AgentStatus
}

function validateCreateInput(input: unknown): AgentCreateInput | undefined {
  if (input === undefined) return undefined
  if (!input || typeof input !== 'object') {
    throw new Error('Create input must be an object.')
  }
  const candidate = input as Partial<AgentCreateInput>
  if (candidate.title !== undefined && typeof candidate.title !== 'string') {
    throw new Error('Title must be a string.')
  }
  return {
    title: candidate.title
  }
}

function validateUpdatePlanInput(input: unknown): AgentUpdatePlanInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Update plan input must be an object.')
  }
  const candidate = input as Partial<AgentUpdatePlanInput>
  return {
    id: validateNonEmptyString(candidate.id, 'Agent id'),
    planText: typeof candidate.planText === 'string' ? candidate.planText : ''
  }
}

function validateSetStatusInput(input: unknown): AgentSetStatusInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Set status input must be an object.')
  }
  const candidate = input as Partial<AgentSetStatusInput>
  if (
    candidate.note !== undefined &&
    candidate.note !== null &&
    typeof candidate.note !== 'string'
  ) {
    throw new Error('Status note must be a string when provided.')
  }
  if (
    candidate.awaitingNote !== undefined &&
    candidate.awaitingNote !== null &&
    typeof candidate.awaitingNote !== 'string'
  ) {
    throw new Error('Awaiting note must be a string when provided.')
  }

  return {
    id: validateNonEmptyString(candidate.id, 'Agent id'),
    status: validateStatus(candidate.status),
    note: candidate.note,
    awaitingNote: candidate.awaitingNote
  }
}

function validateAnswerClarificationInput(input: unknown): AgentAnswerClarificationInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Answer clarification input must be an object.')
  }
  const candidate = input as Partial<AgentAnswerClarificationInput>

  return {
    id: validateNonEmptyString(candidate.id, 'Agent id'),
    clarificationId: validateNonEmptyString(candidate.clarificationId, 'Clarification id'),
    answer: validateNonEmptyString(candidate.answer, 'Answer')
  }
}

function validateArchiveInput(input: unknown): AgentArchiveInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Archive input must be an object.')
  }
  const candidate = input as Partial<AgentArchiveInput>
  return {
    id: validateNonEmptyString(candidate.id, 'Agent id')
  }
}

function validateDeleteInput(input: unknown): AgentDeleteInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Delete input must be an object.')
  }
  const candidate = input as Partial<AgentDeleteInput>
  return {
    id: validateNonEmptyString(candidate.id, 'Agent id')
  }
}

function removeAgentHandlers(): void {
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.list)
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.create)
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.updatePlan)
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.setStatus)
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.answerClarification)
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.archive)
  ipcMain.removeHandler(AGENTS_IPC_CHANNELS.delete)
}

export function registerAgentsIpc(): () => void {
  const repository = createAgentsRepository()
  removeAgentHandlers()

  ipcMain.handle(AGENTS_IPC_CHANNELS.list, (event) => {
    return repository.list(resolveWindowId(event))
  })

  ipcMain.handle(AGENTS_IPC_CHANNELS.create, (event, input?: unknown) => {
    return repository.create(resolveWindowId(event), validateCreateInput(input))
  })

  ipcMain.handle(AGENTS_IPC_CHANNELS.updatePlan, (event, input: unknown) => {
    return repository.updatePlan(resolveWindowId(event), validateUpdatePlanInput(input))
  })

  ipcMain.handle(AGENTS_IPC_CHANNELS.setStatus, (event, input: unknown) => {
    return repository.setStatus(resolveWindowId(event), validateSetStatusInput(input))
  })

  ipcMain.handle(AGENTS_IPC_CHANNELS.answerClarification, (event, input: unknown) => {
    return repository.answerClarification(
      resolveWindowId(event),
      validateAnswerClarificationInput(input)
    )
  })

  ipcMain.handle(AGENTS_IPC_CHANNELS.archive, (event, input: unknown) => {
    return repository.archive(resolveWindowId(event), validateArchiveInput(input))
  })

  ipcMain.handle(AGENTS_IPC_CHANNELS.delete, (event, input: unknown) => {
    return repository.delete(resolveWindowId(event), validateDeleteInput(input))
  })

  return () => {
    removeAgentHandlers()
  }
}
