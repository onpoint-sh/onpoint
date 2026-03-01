import * as React from 'react'

import { cn } from '../lib/utils'
import { statusClassByValue, statusLabelByValue, type AgentStatus } from '../lib/agent-status'

type AgentStatusChipProps = {
  status: AgentStatus
  className?: string
}

function AgentStatusChip({ status, className }: AgentStatusChipProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[0.68rem] font-medium leading-none',
        statusClassByValue[status],
        className
      )}
    >
      {statusLabelByValue[status]}
    </span>
  )
}

export { AgentStatusChip }
