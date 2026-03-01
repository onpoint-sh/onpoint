export type AgentStatus =
  | 'planned'
  | 'needs_clarification'
  | 'awaiting_response'
  | 'in_progress'
  | 'done'

export type AgentClarificationOption = {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

export type AgentClarificationState = 'open' | 'answered' | 'dismissed'

export type AgentClarification = {
  id: string
  prompt: string
  options?: AgentClarificationOption[]
  answer?: string
  state: AgentClarificationState
  createdAt: string
  answeredAt?: string
}

export type AgentActivityItem = {
  id: string
  timestamp: string
  message: string
}

export type AgentRecord = {
  id: string
  title: string
  status: AgentStatus
  planText: string | null
  metricsLabel: string | null
  clarifications: AgentClarification[]
  activity: AgentActivityItem[]
  awaitingNote: string | null
  archivedAtMs: number | null
  createdAtMs: number
  updatedAtMs: number
}

export type AgentCreateInput = {
  title?: string
}

export type AgentUpdatePlanInput = {
  id: string
  planText: string
}

export type AgentSetStatusInput = {
  id: string
  status: AgentStatus
  note?: string | null
  awaitingNote?: string | null
}

export type AgentAnswerClarificationInput = {
  id: string
  clarificationId: string
  answer: string
}

export type AgentArchiveInput = {
  id: string
}

export type AgentDeleteInput = {
  id: string
}

export const AGENTS_IPC_CHANNELS = {
  list: 'agents:list',
  create: 'agents:create',
  updatePlan: 'agents:update-plan',
  setStatus: 'agents:set-status',
  answerClarification: 'agents:answer-clarification',
  archive: 'agents:archive',
  delete: 'agents:delete'
} as const
