import { create } from 'zustand'
import type {
  AgentAnswerClarificationInput,
  AgentRecord,
  AgentSetStatusInput,
  AgentUpdatePlanInput
} from '@onpoint/shared/agents'

type AgentsStoreState = {
  records: AgentRecord[]
  isLoading: boolean
  error: string | null
  loadAgents: () => Promise<void>
  addAgent: () => Promise<void>
  archiveAgent: (id: string) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  updatePlan: (input: AgentUpdatePlanInput) => Promise<void>
  setStatus: (input: AgentSetStatusInput) => Promise<void>
  answerClarification: (input: AgentAnswerClarificationInput) => Promise<void>
}

function normalizeUiError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
  }
  return fallback
}

function upsert(records: AgentRecord[], updated: AgentRecord): AgentRecord[] {
  const next = records.filter((item) => item.id !== updated.id)
  next.push(updated)
  return next.sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

function removeRecord(records: AgentRecord[], id: string): AgentRecord[] {
  return records.filter((item) => item.id !== id)
}

export const useAgentsStore = create<AgentsStoreState>((set) => ({
  records: [],
  isLoading: false,
  error: null,

  loadAgents: async () => {
    set({ isLoading: true, error: null })
    try {
      const records = await window.agents.list()
      set({ records, isLoading: false, error: null })
    } catch (error) {
      set({
        isLoading: false,
        error: normalizeUiError(error, 'Failed to load agents.')
      })
    }
  },

  addAgent: async () => {
    set({ error: null })
    try {
      const created = await window.agents.create()
      set((state) => ({
        records: [created, ...state.records.filter((item) => item.id !== created.id)]
      }))
    } catch (error) {
      set({
        error: normalizeUiError(error, 'Failed to create agent row.')
      })
    }
  },

  archiveAgent: async (id) => {
    set({ error: null })
    try {
      await window.agents.archive({ id })
      set((state) => ({ records: removeRecord(state.records, id) }))
    } catch (error) {
      set({
        error: normalizeUiError(error, 'Failed to archive agent.')
      })
    }
  },

  deleteAgent: async (id) => {
    set({ error: null })
    try {
      await window.agents.delete({ id })
      set((state) => ({ records: removeRecord(state.records, id) }))
    } catch (error) {
      set({
        error: normalizeUiError(error, 'Failed to delete agent.')
      })
    }
  },

  updatePlan: async (input) => {
    set({ error: null })
    try {
      const updated = await window.agents.updatePlan(input)
      set((state) => ({ records: upsert(state.records, updated) }))
    } catch (error) {
      set({
        error: normalizeUiError(error, 'Failed to update plan.')
      })
    }
  },

  setStatus: async (input) => {
    set({ error: null })
    try {
      const updated = await window.agents.setStatus(input)
      set((state) => ({ records: upsert(state.records, updated) }))
    } catch (error) {
      set({
        error: normalizeUiError(error, 'Failed to update status.')
      })
    }
  },

  answerClarification: async (input) => {
    set({ error: null })
    try {
      const updated = await window.agents.answerClarification(input)
      set((state) => ({ records: upsert(state.records, updated) }))
    } catch (error) {
      set({
        error: normalizeUiError(error, 'Failed to submit clarification answer.')
      })
    }
  }
}))
