import { type ShortcutContextMap } from '@onpoint/shared/shortcut-when'
import { getFileType, type FileType } from '@/lib/file-types'
import { useLayoutStore } from '@/stores/layout-store'
import { usePanesStore } from '@/stores/panes-store'
import { useTerminalStore } from '@/stores/terminal-store'
import { isEditableTarget, isShortcutCaptureTarget } from './is-editable-target'

type ShortcutContextOptions = {
  searchPaletteVisible: boolean
}

function getActiveEditorType(): FileType | 'none' {
  const activeTab = usePanesStore.getState().getActiveTabInFocusedPane()
  if (!activeTab?.relativePath) {
    return 'none'
  }

  return getFileType(activeTab.relativePath)
}

function isElement(target: EventTarget | null): target is Element {
  return target instanceof Element
}

function hasClosest(target: EventTarget | null, selector: string): boolean {
  if (!isElement(target)) return false
  return Boolean(target.closest(selector))
}

export function buildShortcutContext(
  target: EventTarget | null,
  options: ShortcutContextOptions
): ShortcutContextMap {
  const activeEditor = getActiveEditorType()

  const markdownEditorFocus = hasClosest(target, '.notes-rich-editor')
  const monacoEditorFocus = hasClosest(target, '.monaco-editor')
  const codeEditorFocus = monacoEditorFocus && activeEditor === 'code'
  const mermaidEditorFocus = monacoEditorFocus && activeEditor === 'mermaid'

  const editorFocus = markdownEditorFocus || monacoEditorFocus
  const editorTextFocus = editorFocus && isEditableTarget(target)

  const shortcutCapture = isShortcutCaptureTarget(target)
  const searchInputFocus = hasClosest(target, '.search-palette-input')
  const settingsFocus = window.location.pathname.startsWith('/settings')
  const sidebarVisible = useLayoutStore.getState().isSidebarOpen
  const terminalFocus = useTerminalStore.getState().isTerminalFocus
  const terminalTextFocus = useTerminalStore.getState().isTerminalTextFocus

  return {
    windowFocus: document.hasFocus(),
    shortcutCapture,
    editorFocus,
    editorTextFocus,
    markdownEditorFocus,
    codeEditorFocus,
    mermaidEditorFocus,
    searchPaletteVisible: options.searchPaletteVisible,
    searchInputFocus,
    settingsFocus,
    sidebarVisible,
    activeEditor,
    terminalFocus,
    terminalTextFocus
  }
}

export type { ShortcutContextOptions }
