import { Command } from 'commander'
import { setDefaultCommand } from './set-default.js'
import { infoCommand } from './info.js'
import { loadCliConfig } from '../../lib/config.js'
import { formatOutput } from '../../lib/output.js'

const printDefaultCommand = new Command('print-default')
  .description('Print the current default vault path')
  .action(async (_options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    const config = await loadCliConfig()

    formatOutput({ defaultVault: config.defaultVault }, globalOpts, {
      human: (data) => {
        if (data.defaultVault) {
          console.log(data.defaultVault)
        } else {
          console.log('No default vault configured.')
        }
      }
    })
  })

export const vaultCommand = new Command('vault')
  .description('Vault management')
  .addCommand(setDefaultCommand)
  .addCommand(printDefaultCommand)
  .addCommand(infoCommand)
