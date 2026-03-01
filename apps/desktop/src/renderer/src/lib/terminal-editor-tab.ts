const TERMINAL_EDITOR_PATH_PREFIX = 'terminal://'

function createTerminalEditorPath(id: string = crypto.randomUUID()): string {
  return `${TERMINAL_EDITOR_PATH_PREFIX}${id}`
}

function isTerminalEditorPath(path: string | null | undefined): boolean {
  if (!path) return false
  return path.startsWith(TERMINAL_EDITOR_PATH_PREFIX)
}

function getTerminalEditorId(path: string): string {
  if (!isTerminalEditorPath(path)) return ''
  return path.slice(TERMINAL_EDITOR_PATH_PREFIX.length)
}

export {
  createTerminalEditorPath,
  getTerminalEditorId,
  isTerminalEditorPath,
  TERMINAL_EDITOR_PATH_PREFIX
}
