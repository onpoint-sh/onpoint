import { describe, expect, it } from 'vitest'
import { AGENTS_IPC_CHANNELS, type AgentStatus } from '@onpoint/shared/agents'

describe('agents shared contracts', () => {
  it('defines stable IPC channels', () => {
    expect(AGENTS_IPC_CHANNELS.list).toBe('agents:list')
    expect(AGENTS_IPC_CHANNELS.create).toBe('agents:create')
    expect(AGENTS_IPC_CHANNELS.updatePlan).toBe('agents:update-plan')
    expect(AGENTS_IPC_CHANNELS.setStatus).toBe('agents:set-status')
    expect(AGENTS_IPC_CHANNELS.answerClarification).toBe('agents:answer-clarification')
    expect(AGENTS_IPC_CHANNELS.archive).toBe('agents:archive')
    expect(AGENTS_IPC_CHANNELS.delete).toBe('agents:delete')
  })

  it('supports the fixed agent status model', () => {
    const statuses: AgentStatus[] = [
      'planned',
      'needs_clarification',
      'awaiting_response',
      'in_progress',
      'done'
    ]

    expect(statuses).toHaveLength(5)
    expect(statuses).toContain('awaiting_response')
  })
})
