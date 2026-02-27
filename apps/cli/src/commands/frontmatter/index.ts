import { Command } from 'commander'
import { readCommand } from './read.js'
import { setCommand } from './set.js'

export const frontmatterCommand = new Command('frontmatter')
  .description('Frontmatter metadata operations')
  .addCommand(readCommand)
  .addCommand(setCommand)
