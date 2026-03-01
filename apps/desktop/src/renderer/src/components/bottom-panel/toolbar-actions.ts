import { Columns2, Maximize2, Minimize2, Plus, Trash2, X, type LucideIcon } from 'lucide-react'
import type { BottomPanelTab, BottomPanelStoreState } from '@/stores/bottom-panel-store'

type BottomPanelToolbarTone = 'default' | 'danger'

export type BottomPanelToolbarAction = {
  id: string
  label: string
  icon: LucideIcon
  onTrigger: () => void
  tone?: BottomPanelToolbarTone
}

type BottomPanelToolbarApi = Pick<
  BottomPanelStoreState,
  'openView' | 'splitPane' | 'closeTab' | 'toggleMaximize' | 'hidePanel'
>

type BuildViewActionsOptions = {
  paneId: string
  activeTab: BottomPanelTab | null
  api: BottomPanelToolbarApi
}

type BuildGlobalActionsOptions = {
  isMaximized: boolean
  onOpenAddViewMenu: () => void
  api: BottomPanelToolbarApi
}

export function buildViewToolbarActions({
  paneId,
  activeTab,
  api
}: BuildViewActionsOptions): BottomPanelToolbarAction[] {
  if (!activeTab) return []

  const closeActiveTab = (): void => {
    api.closeTab(paneId, activeTab.id)
  }

  if (activeTab.viewId === 'terminal') {
    return [
      {
        id: 'new-terminal-session',
        label: 'New Terminal Session',
        icon: Plus,
        onTrigger: () => {
          api.openView('terminal', paneId, { allowDuplicate: true })
        }
      },
      {
        id: 'split-terminal-panel',
        label: 'Split Terminal Panel',
        icon: Columns2,
        onTrigger: () => {
          api.splitPane(paneId, 'row', 'terminal')
        }
      },
      {
        id: 'close-terminal-tab',
        label: 'Close Terminal Tab',
        icon: Trash2,
        onTrigger: closeActiveTab,
        tone: 'danger'
      }
    ]
  }

  if (activeTab.viewId === 'problems') {
    return [
      {
        id: 'new-problems-view',
        label: 'New Problems View',
        icon: Plus,
        onTrigger: () => {
          api.openView('problems', paneId, { allowDuplicate: true })
        }
      },
      {
        id: 'split-problems-panel',
        label: 'Split Problems Panel',
        icon: Columns2,
        onTrigger: () => {
          api.splitPane(paneId, 'row', 'problems')
        }
      },
      {
        id: 'close-problems-tab',
        label: 'Close Problems Tab',
        icon: Trash2,
        onTrigger: closeActiveTab,
        tone: 'danger'
      }
    ]
  }

  return [
    {
      id: 'new-output-view',
      label: 'New Output View',
      icon: Plus,
      onTrigger: () => {
        api.openView('output', paneId, { allowDuplicate: true })
      }
    },
    {
      id: 'split-output-panel',
      label: 'Split Output Panel',
      icon: Columns2,
      onTrigger: () => {
        api.splitPane(paneId, 'row', 'output')
      }
    },
    {
      id: 'close-output-tab',
      label: 'Close Output Tab',
      icon: Trash2,
      onTrigger: closeActiveTab,
      tone: 'danger'
    }
  ]
}

export function buildGlobalToolbarActions({
  isMaximized,
  onOpenAddViewMenu,
  api
}: BuildGlobalActionsOptions): BottomPanelToolbarAction[] {
  return [
    {
      id: 'add-panel-tab',
      label: 'Add Panel Tab',
      icon: Plus,
      onTrigger: onOpenAddViewMenu
    },
    {
      id: isMaximized ? 'restore-panel-size' : 'maximize-panel-size',
      label: isMaximized ? 'Restore Panel Size' : 'Expand Panel',
      icon: isMaximized ? Minimize2 : Maximize2,
      onTrigger: () => {
        api.toggleMaximize()
      }
    },
    {
      id: 'hide-panel',
      label: 'Hide Panel (Command/Ctrl+J)',
      icon: X,
      onTrigger: () => {
        api.hidePanel()
      },
      tone: 'danger'
    }
  ]
}
