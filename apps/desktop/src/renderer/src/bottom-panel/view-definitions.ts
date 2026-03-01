export type BottomPanelViewId = 'terminal' | 'problems' | 'output'

export type BottomPanelViewDefinition = {
  id: BottomPanelViewId
  title: string
  description: string
}

export const BOTTOM_PANEL_DEFAULT_VIEW_ID: BottomPanelViewId = 'terminal'

export const BOTTOM_PANEL_VIEW_DEFINITIONS: readonly BottomPanelViewDefinition[] = [
  {
    id: 'terminal',
    title: 'Terminal',
    description: 'Shell sessions and command output.'
  },
  {
    id: 'problems',
    title: 'Problems',
    description: 'Compiler, linter, and diagnostics stream.'
  },
  {
    id: 'output',
    title: 'Output',
    description: 'Runtime logs and system messages.'
  }
] as const

export const BOTTOM_PANEL_VIEW_DEFINITIONS_BY_ID = BOTTOM_PANEL_VIEW_DEFINITIONS.reduce<
  Record<BottomPanelViewId, BottomPanelViewDefinition>
>(
  (accumulator, definition) => {
    accumulator[definition.id] = definition
    return accumulator
  },
  {} as Record<BottomPanelViewId, BottomPanelViewDefinition>
)
