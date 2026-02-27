import { Command } from 'commander'
import { createVaultFolder } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const createCommand = new Command('create')
  .description('Create a folder in the vault')
  .argument('<path>', 'Relative folder path')
  .action(async (folderPath: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const result = await createVaultFolder(vaultPath, folderPath)

      formatOutput(result, globalOpts, {
        human: (data) => {
          console.log(`Created: ${data.relativePath}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
