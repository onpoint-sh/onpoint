type AgentStatus = 'planned' | 'needs_clarification' | 'awaiting_response' | 'in_progress' | 'done'

const statusLabelByValue: Record<AgentStatus, string> = {
  planned: 'Planned',
  needs_clarification: 'Needs clarification',
  awaiting_response: 'Awaiting response',
  in_progress: 'In progress',
  done: 'Done'
}

const statusClassByValue: Record<AgentStatus, string> = {
  planned: 'bg-transparent text-muted-foreground border-border/60',
  needs_clarification:
    'bg-transparent text-amber-700 border-amber-300/60 dark:text-amber-200 dark:border-amber-900',
  awaiting_response:
    'bg-transparent text-emerald-700 border-emerald-300/60 dark:text-emerald-200 dark:border-emerald-900',
  in_progress:
    'bg-transparent text-blue-700 border-blue-300/60 dark:text-blue-200 dark:border-blue-900',
  done: 'bg-transparent text-zinc-700 border-zinc-300/70 dark:text-zinc-200 dark:border-zinc-700'
}

export { statusClassByValue, statusLabelByValue, type AgentStatus }
