import { Command } from 'commander'
import { listVaultNotes, sortNotes } from '@onpoint/notes-core/vault-files'
import type { NoteSortField } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const listCommand = new Command('list')
  .description('List all notes in the vault')
  .option('--sort <field>', 'Sort by: mtime, title, path', 'mtime')
  .option('--limit <n>', 'Limit number of results', parseInt)
  .action(async (options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const allNotes = await listVaultNotes(vaultPath)
      let notes = sortNotes(allNotes, options.sort as NoteSortField)

      if (options.limit) {
        notes = notes.slice(0, options.limit)
      }

      formatOutput(notes, globalOpts, {
        human: (notes) => {
          for (const note of notes) {
            const date = new Date(note.mtimeMs).toLocaleDateString()
            console.log(`${note.title.padEnd(40)}  ${date}  ${note.relativePath}`)
          }
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
