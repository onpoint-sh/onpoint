import { Columns2, Maximize2, Minimize2, Trash2, X, type LucideIcon } from 'lucide-react'
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
  terminalApi?: {
    splitRight: () => void
    splitDown: () => void
  }
}

type BuildGlobalActionsOptions = {
  isMaximized: boolean
  api: BottomPanelToolbarApi
}

export function buildViewToolbarActions({
  paneId,
  activeTab,
  api,
  terminalApi
}: BuildViewActionsOptions): BottomPanelToolbarAction[] {
  if (!activeTab) return []

  const closeActiveTab = (): void => {
    api.closeTab(paneId, activeTab.id)
  }

  if (activeTab.viewId === 'terminal') {
    return [
      {
        id: 'split-terminal-right',
        label: 'Split Right',
        icon: Columns2,
        onTrigger: () => {
          if (terminalApi) {
            terminalApi.splitRight()
            return
          }
          api.splitPane(paneId, 'row', 'terminal')
        }
      },
      {
        id: 'split-terminal-down',
        label: 'Split Down',
        icon: Columns2,
        onTrigger: () => {
          if (terminalApi) {
            terminalApi.splitDown()
            return
          }
          api.splitPane(paneId, 'column', 'terminal')
        }
      }
    ]
  }

  if (activeTab.viewId === 'problems') {
    return [
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
  api
}: BuildGlobalActionsOptions): BottomPanelToolbarAction[] {
  return [
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
