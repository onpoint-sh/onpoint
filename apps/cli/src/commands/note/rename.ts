import { Command } from 'commander'
import { renameVaultNote } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const renameCommand = new Command('rename')
  .description('Rename a note title')
  .argument('<path>', 'Relative path to the note')
  .argument('<title>', 'New title')
  .action(async (notePath: string, title: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const result = await renameVaultNote(vaultPath, notePath, title)

      formatOutput(
        { relativePath: result.relativePath, mtimeMs: result.mtimeMs },
        globalOpts,
        {
          human: (data) => {
            console.log(`Renamed: ${data.relativePath}`)
          }
        }
      )
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
