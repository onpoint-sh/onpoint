export type MockNote = {
  relativePath: string
  title: string
  content: string
  mtimeMs: number
}

export type PaneTab = {
  id: string
  relativePath: string
  pinned?: boolean
}

export type Pane = {
  id: string
  tabs: PaneTab[]
  activeTabId: string | null
}
