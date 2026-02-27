import { Command } from 'commander'
import { moveVaultNote } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const moveCommand = new Command('move')
  .description('Move a note to a new path')
  .argument('<from>', 'Current relative path')
  .argument('<to>', 'New relative path')
  .action(async (from: string, to: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const result = await moveVaultNote(vaultPath, from, to)

      formatOutput(result, globalOpts, {
        human: (data) => {
          console.log(`Moved to: ${data.relativePath}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
