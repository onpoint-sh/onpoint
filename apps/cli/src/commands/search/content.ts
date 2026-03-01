import { Command } from 'commander'
import { searchVaultContentV2 } from '@onpoint/notes-core/vault-files'
import { stripCodeBlocks, stripMarkdown } from '@onpoint/notes-core/markdown-strip'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'
import { buildSearchQueryOptions, collectRepeatableOption, parseLimit } from './options.js'

export const contentCommand = new Command('content')
  .description('Full-text search in note bodies')
  .argument('<query>', 'Search query')
  .option('--limit <n>', 'Max results', parseLimit, 20)
  .option('--include <glob>', 'Include glob (repeatable)', collectRepeatableOption, [])
  .option('--exclude <glob>', 'Exclude glob (repeatable)', collectRepeatableOption, [])
  .option('--type <id>', 'File type or extension (repeatable)', collectRepeatableOption, [])
  .option('--include-ignored', 'Include files ignored by .gitignore/.ignore/.rgignore')
  .option('--case-sensitive', 'Case-sensitive content matching')
  .option('--regex', 'Treat query as a regular expression')
  .option('--plain', 'Strip markdown from snippets')
  .option('--no-codeblocks', 'Remove code blocks from snippets')
  .action(async (query: string, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const searchOptions = buildSearchQueryOptions(options)
      const matches = await searchVaultContentV2(vaultPath, query, searchOptions)

      if (options.codeblocks === false || options.plain === true) {
        for (const match of matches) {
          if (options.codeblocks === false) {
            match.snippet = stripCodeBlocks(match.snippet)
          }
          if (options.plain === true) {
            match.snippet = stripMarkdown(match.snippet)
          }
        }
      }

      const payload = globalOpts.json
        ? {
            query,
            options: searchOptions,
            matches
          }
        : matches

      formatOutput(payload, globalOpts, {
        human: (items) => {
          const rows = Array.isArray(items) ? items : items.matches
          for (const item of rows) {
            console.log(`${item.title}  (${item.relativePath})`)
            const prefix = item.line ? `L${item.line}:${item.column ?? 1} ` : ''
            console.log(`  ${prefix}${item.snippet}`)
            console.log()
          }
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
