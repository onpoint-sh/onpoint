import { Command } from 'commander'
import { openVaultNote, saveVaultNote } from '@onpoint/notes-core/vault-files'
import {
  parseFrontmatter,
  buildNoteContent,
  isSupportedFrontmatterKey,
  setFrontmatterProperty,
  SUPPORTED_FRONTMATTER_KEYS
} from '@onpoint/shared/frontmatter'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const setCommand = new Command('set')
  .description('Set a frontmatter property')
  .argument('<path>', 'Relative path to the note')
  .argument('<key>', 'Property key (title or created)')
  .argument('<value>', 'Property value')
  .action(async (notePath: string, key: string, value: string, _options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const note = await openVaultNote(vaultPath, notePath)
      const { metadata, body } = parseFrontmatter(note.content)

      if (!isSupportedFrontmatterKey(key)) {
        throw new Error(
          `Unknown frontmatter key: ${key}. Supported keys: ${SUPPORTED_FRONTMATTER_KEYS.join(', ')}`
        )
      }

      const updatedMetadata = setFrontmatterProperty(metadata, key, value)
      const updatedContent = buildNoteContent(updatedMetadata, body)
      const result = await saveVaultNote(vaultPath, notePath, updatedContent)

      formatOutput({ key, value, mtimeMs: result.mtimeMs }, globalOpts, {
        human: (data) => {
          console.log(`Set ${data.key} = ${data.value}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })
