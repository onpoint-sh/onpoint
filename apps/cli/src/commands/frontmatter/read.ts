import { Command } from 'commander'
import { openVaultNote } from '@onpoint/notes-core/vault-files'
import { parseFrontmatter } from '@onpoint/shared/frontmatter'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const readCommand = new Command('read')
  .description('Print frontmatter metadata of a note')
  .argument('<path>', 'Relative path to the note')
  .action(async (notePath: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const note = await openVaultNote(vaultPath, notePath)
      const { metadata } = parseFrontmatter(note.content)

      formatOutput(metadata, globalOpts, {
        human: (data) => {
          if (data.title) console.log(`title: ${data.title}`)
          if (data.created) console.log(`created: ${data.created}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
