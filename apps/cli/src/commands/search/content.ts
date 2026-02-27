import { Command } from 'commander'
import { searchVaultContent } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const contentCommand = new Command('content')
  .description('Full-text search in note bodies')
  .argument('<query>', 'Search query')
  .option('--limit <n>', 'Max results', parseInt, 20)
  .option('--plain', 'Strip markdown from snippets')
  .option('--no-codeblocks', 'Remove code blocks from snippets')
  .action(async (query: string, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const matches = await searchVaultContent(vaultPath, query, options.limit, {
        stripCodeBlocks: options.codeblocks === false,
        stripMarkdown: options.plain === true
      })

      formatOutput(matches, globalOpts, {
        human: (items) => {
          for (const item of items) {
            console.log(`${item.title}  (${item.relativePath})`)
            console.log(`  ${item.snippet}`)
            console.log()
          }
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
