export type NoteFrontmatter = {
  title: string | null
  created: string | null
}

export type ParsedNote = {
  metadata: NoteFrontmatter
  body: string
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
const TITLE_RE = /^title:\s*(.+)$/m
const CREATED_RE = /^created:\s*(.+)$/m
const HEADING_RE = /^\s*#(?!#)\s+(.+?)\s*$/m

function needsYamlQuoting(value: string): boolean {
  return /[:#\[\]{}]/.test(value) || value !== value.trim()
}

function yamlQuote(value: string): string {
  if (!needsYamlQuoting(value)) {
    return value
  }

  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function yamlUnquote(value: string): string {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1)
    return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  return trimmed
}

export function parseFrontmatter(raw: string): ParsedNote {
  const match = raw.match(FRONTMATTER_RE)

  if (!match) {
    return {
      metadata: { title: null, created: null },
      body: raw
    }
  }

  const yamlBlock = match[1]
  const titleMatch = yamlBlock.match(TITLE_RE)
  const createdMatch = yamlBlock.match(CREATED_RE)

  const title = titleMatch ? yamlUnquote(titleMatch[1]) : null
  const created = createdMatch ? yamlUnquote(createdMatch[1]) : null

  // Strip the conventional blank line separator after the frontmatter block
  const body = raw.slice(match[0].length).replace(/^\n/, '')

  return {
    metadata: { title, created },
    body
  }
}

export function buildNoteContent(metadata: NoteFrontmatter, body: string): string {
  const lines: string[] = ['---']

  if (metadata.title != null) {
    lines.push(`title: ${yamlQuote(metadata.title)}`)
  }

  if (metadata.created != null) {
    lines.push(`created: ${metadata.created}`)
  }

  lines.push('---')

  const frontmatter = lines.join('\n') + '\n'

  if (body.length === 0) {
    return frontmatter
  }

  return frontmatter + '\n' + body
}

export function extractTitle(raw: string): string | null {
  const { metadata } = parseFrontmatter(raw)
  return metadata.title
}

export function extractBody(raw: string): string {
  const { body } = parseFrontmatter(raw)
  return body
}

export function replaceFrontmatterTitle(raw: string, newTitle: string): string {
  const match = raw.match(FRONTMATTER_RE)

  if (!match) {
    const { metadata } = parseFrontmatter(raw)
    return buildNoteContent(
      { title: newTitle, created: metadata.created },
      raw
    )
  }

  const yamlBlock = match[1]
  const titleLine = `title: ${yamlQuote(newTitle)}`

  let updatedYaml: string

  if (TITLE_RE.test(yamlBlock)) {
    updatedYaml = yamlBlock.replace(TITLE_RE, titleLine)
  } else {
    updatedYaml = titleLine + '\n' + yamlBlock
  }

  const body = raw.slice(match[0].length)
  const closingNewline = match[0].endsWith('\n') ? '\n' : '\n'
  const frontmatterBlock = `---\n${updatedYaml}\n---${closingNewline}`

  return frontmatterBlock + body
}

export function migrateFromHeading(raw: string, created?: string): string {
  if (FRONTMATTER_RE.test(raw)) {
    return raw
  }

  const headingMatch = raw.match(HEADING_RE)

  if (!headingMatch) {
    return raw
  }

  const title = headingMatch[1].trim()

  if (title.length === 0) {
    return raw
  }

  // Remove the heading line from the body
  const headingLineStart = raw.indexOf(headingMatch[0])
  const headingLineEnd = headingLineStart + headingMatch[0].length
  let body = raw.slice(0, headingLineStart) + raw.slice(headingLineEnd)

  // Clean up leading newlines from body
  body = body.replace(/^\n+/, '')

  return buildNoteContent(
    { title, created: created ?? null },
    body
  )
}
