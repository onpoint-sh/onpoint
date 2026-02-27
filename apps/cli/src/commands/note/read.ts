import { Command } from 'commander'
import { openVaultNote } from '@onpoint/notes-core/vault-files'
import {
  stripMarkdown,
  extractSection,
  extractSections,
  stripLinks,
  stripCodeBlocks,
  summarize
} from '@onpoint/notes-core/markdown-strip'
import { extractBody, parseFrontmatter } from '@onpoint/shared/frontmatter'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const readCommand = new Command('read')
  .description('Print note content to stdout')
  .argument('<path>', 'Relative path to the note')
  .option('--body-only', 'Strip frontmatter, return body only')
  .option('--plain', 'Strip all markdown formatting, return raw text')
  .option('--section <heading>', 'Extract a single section by heading')
  .option('--sections <headings>', 'Extract multiple sections (comma-separated)')
  .option('--depth <n>', 'Max heading depth for section extraction', parseInt)
  .option('--no-links', 'Strip link/image URLs, keep display text')
  .option('--no-codeblocks', 'Remove fenced code blocks')
  .option('--max-lines <n>', 'Truncate to first N lines', parseInt)
  .option('--summary-fields', 'Output only title + first paragraph')
  .action(async (notePath: string, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const note = await openVaultNote(vaultPath, notePath)
      let text = note.content

      // --body-only: strip frontmatter
      if (options.bodyOnly) {
        text = extractBody(text)
      }

      // --summary-fields: title + first paragraph only
      if (options.summaryFields) {
        text = summarize(text)
      }

      // --section: extract single section
      if (options.section) {
        text = extractSection(text, options.section, options.depth)
      }

      // --sections: extract multiple sections
      if (options.sections) {
        const headings = (options.sections as string).split(',').map((h: string) => h.trim())
        text = extractSections(text, headings, options.depth)
      }

      // --no-codeblocks: remove fenced code blocks
      if (options.codeblocks === false) {
        text = stripCodeBlocks(text)
      }

      // --no-links: strip URLs
      if (options.links === false) {
        text = stripLinks(text)
      }

      // --plain: strip all markdown formatting
      if (options.plain) {
        text = stripMarkdown(text)
      }

      // --max-lines: truncate
      if (options.maxLines) {
        const lines = text.split('\n')
        text = lines.slice(0, options.maxLines).join('\n')
      }

      if (globalOpts.json) {
        const parsed = parseFrontmatter(note.content)
        formatOutput(
          {
            relativePath: note.relativePath,
            title: parsed.metadata.title,
            created: parsed.metadata.created,
            mtimeMs: note.mtimeMs,
            content: text
          },
          globalOpts,
          { human: () => {} }
        )
      } else {
        process.stdout.write(text + '\n')
      }
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
