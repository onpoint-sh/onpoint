export type GhostModeConfig = {
  opacity: number
}

export const DEFAULT_GHOST_MODE_CONFIG: GhostModeConfig = {
  opacity: 0.85
}

export const GHOST_MODE_OPACITY_MIN = 0.3
export const GHOST_MODE_OPACITY_MAX = 1.0
export const GHOST_MODE_OPACITY_STEP = 0.05

export const GHOST_MODE_IPC_CHANNELS = {
  getState: 'ghost-mode:get-state',
  stateChanged: 'ghost-mode:state-changed',
  getConfig: 'ghost-mode:get-config',
  setOpacity: 'ghost-mode:set-opacity'
} as const
