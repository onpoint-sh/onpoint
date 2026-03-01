export type FileType = 'markdown' | 'mermaid' | 'code'

export function getFileType(relativePath: string): FileType {
  const ext = getFileExtension(relativePath)
  if (ext === '.md') return 'markdown'
  if (ext === '.mmd' || ext === '.mermaid') return 'mermaid'
  return 'code'
}

export function getFileExtension(relativePath: string): string {
  const lastDot = relativePath.lastIndexOf('.')
  if (lastDot === -1) return ''
  return relativePath.slice(lastDot).toLowerCase()
}

export function hasFileExtension(name: string): boolean {
  return /\.[a-zA-Z0-9]{1,10}$/.test(name)
}
