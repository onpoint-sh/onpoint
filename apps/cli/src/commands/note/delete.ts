import { Command } from 'commander'
import { deleteVaultNote } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const deleteCommand = new Command('delete')
  .description('Delete a note')
  .argument('<path>', 'Relative path to the note')
  .action(async (notePath: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const result = await deleteVaultNote(vaultPath, notePath)

      formatOutput(result, globalOpts, {
        human: (data) => {
          console.log(`Deleted: ${data.deletedPath}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
