import { Command } from 'commander'
import { archiveVaultNote } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const archiveCommand = new Command('archive')
  .description('Archive a note')
  .argument('<path>', 'Relative path to the note')
  .action(async (notePath: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const result = await archiveVaultNote(vaultPath, notePath)

      formatOutput(result, globalOpts, {
        human: (data) => {
          console.log(`Archived to: ${data.archivedTo}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
