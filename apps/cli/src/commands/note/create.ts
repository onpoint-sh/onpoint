import { Command } from 'commander'
import { createVaultNote } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const createCommand = new Command('create')
  .description('Create a new note')
  .argument('[title]', 'Note title')
  .option('--folder <path>', 'Create inside a subfolder')
  .action(async (title: string | undefined, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const input = title ? { requestedTitle: title } : undefined
      const note = await createVaultNote(vaultPath, input, options.folder)

      formatOutput(note, globalOpts, {
        human: (note) => {
          console.log(`Created: ${note.relativePath}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
