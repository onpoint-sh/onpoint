/**
 * Context engineering utilities for stripping markdown formatting.
 * Designed to minimize token usage when piping note content to LLMs.
 */

/**
 * Strip all markdown formatting syntax, returning plain text.
 * Removes: headings markers, bold/italic, links, images, code fences,
 * list markers, blockquotes, horizontal rules, and inline code.
 */
export function stripMarkdown(text: string): string {
  let result = text

  // Remove fenced code blocks (``` or ~~~)
  result = result.replace(/^(`{3,}|~{3,})[\s\S]*?^\1\s*$/gm, '')

  // Remove images ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, '')

  // Convert links [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

  // Remove heading markers
  result = result.replace(/^#{1,6}\s+/gm, '')

  // Remove bold/italic markers (order matters: bold first, then italic)
  result = result.replace(/\*{3}(.+?)\*{3}/g, '$1')
  result = result.replace(/_{3}(.+?)_{3}/g, '$1')
  result = result.replace(/\*{2}(.+?)\*{2}/g, '$1')
  result = result.replace(/_{2}(.+?)_{2}/g, '$1')
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1')

  // Remove strikethrough
  result = result.replace(/~~(.+?)~~/g, '$1')

  // Remove inline code
  result = result.replace(/`([^`]+)`/g, '$1')

  // Remove blockquote markers
  result = result.replace(/^>\s?/gm, '')

  // Remove unordered list markers
  result = result.replace(/^[\t ]*[-*+]\s+/gm, '')

  // Remove ordered list markers
  result = result.replace(/^[\t ]*\d+\.\s+/gm, '')

  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}\s*$/gm, '')

  // Remove task list markers
  result = result.replace(/\[[ x]\]\s*/gi, '')

  // Collapse multiple blank lines into one
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/**
 * Extract content under a specific heading, up to the next heading of same or higher level.
 * @param text - Full markdown text
 * @param heading - Heading text to find (without # prefix)
 * @param maxDepth - Optional max heading depth (1-6). If set, only stop at headings <= maxDepth.
 */
export function extractSection(text: string, heading: string, maxDepth?: number): string {
  const lines = text.split('\n')
  const lowerHeading = heading.toLowerCase().trim()
  let capturing = false
  let sectionLevel = 0
  const result: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/)

    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = headingMatch[2].toLowerCase().trim()

      if (!capturing && headingText === lowerHeading) {
        capturing = true
        sectionLevel = level
        result.push(line)
        continue
      }

      if (capturing) {
        const stopLevel = maxDepth ? Math.min(sectionLevel, maxDepth) : sectionLevel
        if (level <= stopLevel) {
          break
        }
      }
    }

    if (capturing) {
      result.push(line)
    }
  }

  return result.join('\n').trim()
}

/**
 * Extract multiple sections by heading name.
 */
export function extractSections(text: string, headings: string[], maxDepth?: number): string {
  return headings
    .map((h) => extractSection(text, h, maxDepth))
    .filter((s) => s.length > 0)
    .join('\n\n')
}

/**
 * Strip link and image URLs, keeping display text.
 * [text](url) → text
 * ![alt](url) → (removed entirely)
 */
export function stripLinks(text: string): string {
  // Remove images entirely
  let result = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
  // Convert links to just their display text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  return result
}

/**
 * Remove fenced code blocks entirely.
 */
export function stripCodeBlocks(text: string): string {
  return text.replace(/^(`{3,}|~{3,}).*\n[\s\S]*?^\1\s*$/gm, '').trim()
}

/**
 * Extract title + first paragraph as a quick summary.
 */
export function summarize(text: string): string {
  const lines = text.split('\n')

  // Skip frontmatter
  const firstTrimmed = lines[0]?.trim()
  if (firstTrimmed === '---') {
    const fmEnd = text.indexOf('\n---', text.indexOf('---') + 3)
    if (fmEnd !== -1) {
      const afterFm = text.slice(fmEnd + 4).split('\n')
      return summarizeLines(afterFm)
    }
  }

  return summarizeLines(lines)
}

function summarizeLines(lines: string[]): string {
  const result: string[] = []
  let foundContent = false
  let paragraphStarted = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines at the start
    if (!foundContent && trimmed.length === 0) continue

    // Include heading
    if (!foundContent && trimmed.match(/^#{1,6}\s+/)) {
      result.push(line)
      foundContent = true
      continue
    }

    // First non-empty content line starts the paragraph
    if (!paragraphStarted && trimmed.length > 0) {
      foundContent = true
      paragraphStarted = true
      result.push(line)
      continue
    }

    // Continue paragraph until empty line
    if (paragraphStarted && trimmed.length > 0) {
      result.push(line)
      continue
    }

    // Empty line after paragraph — done
    if (paragraphStarted && trimmed.length === 0) {
      break
    }
  }

  return result.join('\n').trim()
}
