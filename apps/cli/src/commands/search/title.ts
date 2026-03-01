import { Command } from 'commander'
import { searchVaultTitlesV2 } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'
import { buildSearchQueryOptions, collectRepeatableOption, parseLimit } from './options.js'

export const titleCommand = new Command('title')
  .description('Fuzzy search notes by title')
  .argument('<query>', 'Search query')
  .option('--limit <n>', 'Max results', parseLimit, 20)
  .option('--include <glob>', 'Include glob (repeatable)', collectRepeatableOption, [])
  .option('--exclude <glob>', 'Exclude glob (repeatable)', collectRepeatableOption, [])
  .option('--type <id>', 'File type or extension (repeatable)', collectRepeatableOption, [])
  .option('--include-ignored', 'Include files ignored by .gitignore/.ignore/.rgignore')
  .option('--case-sensitive', 'Case-sensitive title/path matching')
  .action(async (query: string, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const searchOptions = buildSearchQueryOptions({
        ...options,
        regex: false
      })
      const results = await searchVaultTitlesV2(vaultPath, query, searchOptions)

      const payload = globalOpts.json
        ? {
            query,
            options: searchOptions,
            matches: results
          }
        : results
      formatOutput(payload, globalOpts, {
        human: (items) => {
          const rows = Array.isArray(items) ? items : items.matches
          for (const item of rows) {
            console.log(`${item.title.padEnd(40)}  ${item.relativePath}`)
          }
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
