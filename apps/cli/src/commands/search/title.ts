import { Command } from 'commander'
import { listVaultNotes } from '@onpoint/notes-core/vault-files'
import { fuzzySearchNotes } from '@onpoint/notes-core/fuzzy-search'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const titleCommand = new Command('title')
  .description('Fuzzy search notes by title')
  .argument('<query>', 'Search query')
  .option('--limit <n>', 'Max results', parseInt, 20)
  .action(async (query: string, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const notes = await listVaultNotes(vaultPath)
      const results = fuzzySearchNotes(notes, query, options.limit)

      formatOutput(
        results.map((r) => ({ ...r.note, score: r.score })),
        globalOpts,
        {
          human: (items) => {
            for (const item of items) {
              console.log(`${item.title.padEnd(40)}  ${item.relativePath}`)
            }
          }
        }
      )
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
