#!/usr/bin/env tsx

import { Command } from 'commander'
import { noteCommand } from './commands/note/index.js'
import { searchCommand } from './commands/search/index.js'
import { frontmatterCommand } from './commands/frontmatter/index.js'
import { vaultCommand } from './commands/vault/index.js'
import { folderCommand } from './commands/folder/index.js'

const program = new Command()
  .name('onpoint')
  .description('Onpoint notes CLI — read, search, and manipulate your notes from the terminal')
  .version('0.1.0')
  .option('--vault <path>', 'Path to notes vault')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colors')
  .option('--verbose', 'Show debug info')

program.addCommand(noteCommand)
program.addCommand(searchCommand)
program.addCommand(frontmatterCommand)
program.addCommand(vaultCommand)
program.addCommand(folderCommand)

process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(143))

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`)
  process.exit(1)
})
