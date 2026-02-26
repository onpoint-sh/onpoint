/**
 * In-memory store for untitled tab content.
 * Preserves content across tab switches where the editor unmounts/remounts
 * (due to the key prop). Untitled tabs have no disk file to persist to,
 * so this map acts as the backing store until the user does "Save As".
 */
const store = new Map<string, string>()

export function getUntitledContent(path: string): string {
  return store.get(path) ?? ''
}

export function setUntitledContent(path: string, content: string): void {
  if (content === '') {
    store.delete(path)
  } else {
    store.set(path, content)
  }
}

export function deleteUntitledContent(path: string): void {
  store.delete(path)
}
