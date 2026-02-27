import { Command } from 'commander'
import { resolve } from 'node:path'
import { ensureVaultPath } from '@onpoint/notes-core/vault-files'
import { loadCliConfig, saveCliConfig } from '../../lib/config.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const setDefaultCommand = new Command('set-default')
  .description('Set the default vault path')
  .argument('<path>', 'Path to the notes vault directory')
  .action(async (vaultPath: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const resolved = await ensureVaultPath(resolve(vaultPath))
      const config = await loadCliConfig()
      config.defaultVault = resolved
      await saveCliConfig(config)

      formatOutput({ defaultVault: resolved }, globalOpts, {
        human: (data) => {
          console.log(`Default vault set to: ${data.defaultVault}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
