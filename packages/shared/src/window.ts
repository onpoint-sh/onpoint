export type DetachedInitData = {
  relativePath: string
}

export const WINDOW_IPC_CHANNELS = {
  detachTab: 'window:detach-tab',
  getDetachInit: 'window:get-detach-init',
  newWindow: 'window:new-window',
  getWindowId: 'window:get-window-id'
} as const
