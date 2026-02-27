import { Command } from 'commander'
import { titleCommand } from './title.js'
import { contentCommand } from './content.js'

export const searchCommand = new Command('search')
  .description('Search notes')
  .addCommand(titleCommand)
  .addCommand(contentCommand)
