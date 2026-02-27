import { Command } from 'commander'
import { createCommand } from './create.js'
import { renameCommand } from './rename.js'

export const folderCommand = new Command('folder')
  .description('Folder operations')
  .addCommand(createCommand)
  .addCommand(renameCommand)
