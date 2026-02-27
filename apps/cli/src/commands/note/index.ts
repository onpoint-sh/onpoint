import { Command } from 'commander'
import { listCommand } from './list.js'
import { createCommand } from './create.js'
import { readCommand } from './read.js'
import { deleteCommand } from './delete.js'
import { moveCommand } from './move.js'
import { renameCommand } from './rename.js'
import { archiveCommand } from './archive.js'

export const noteCommand = new Command('note')
  .description('Note operations')
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(readCommand)
  .addCommand(deleteCommand)
  .addCommand(moveCommand)
  .addCommand(renameCommand)
  .addCommand(archiveCommand)
