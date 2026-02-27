import { Command } from 'commander'
import { listVaultNotes } from '@onpoint/notes-core/vault-files'
import { resolveVaultPath } from '../../lib/vault-resolver.js'
import { formatOutput } from '../../lib/output.js'
import { handleError } from '../../lib/errors.js'

export const infoCommand = new Command('info')
  .description('Show vault information')
  .action(async (_options, cmd) => {
    const globalOpts = cmd.optsWithGlobals()
    try {
      const vaultPath = await resolveVaultPath(globalOpts)
      const notes = await listVaultNotes(vaultPath)
      const totalSize = notes.reduce((sum, n) => sum + n.size, 0)

      const info = {
        path: vaultPath,
        noteCount: notes.length,
        totalSizeBytes: totalSize
      }

      formatOutput(info, globalOpts, {
        human: (data) => {
          console.log(`Vault: ${data.path}`)
          console.log(`Notes: ${data.noteCount}`)
          console.log(`Size:  ${formatBytes(data.totalSizeBytes)}`)
        }
      })
    } catch (error) {
      handleError(error, globalOpts)
    }
  })

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
