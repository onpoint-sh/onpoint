import { Command } from 'commander'
import { renameVaultFolder } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const renameCommand = new Command('rename')
  .description('Rename a folder')
  .argument('<from>', 'Current folder path')
  .argument('<to>', 'New folder path')
  .action(async (from: string, to: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const result = await renameVaultFolder(vaultPath, from, to)

      formatOutput(result, globalOpts, {
        human: (data) => {
          console.log(`Renamed to: ${data.relativePath}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
