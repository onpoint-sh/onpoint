import { resolve } from 'node:path'
import { loadCliConfig } from './config.js'

export async function resolveVaultPath(options: { vault?: string }): Promise<string> {
  // 1. Explicit --vault flag
  if (options.vault) {
    return resolve(options.vault)
  }

  // 2. Environment variable
  const envVault = process.env.ONPOINT_VAULT
  if (envVault) {
    return resolve(envVault)
  }

  // 3. CLI config file
  const config = await loadCliConfig()
  if (config.defaultVault) {
    return resolve(config.defaultVault)
  }

  // 4. No vault configured
  throw new Error(
    'No vault configured. Set one with:\n' +
      '  onpoint vault set-default <path>\n' +
      '  --vault <path>\n' +
      '  ONPOINT_VAULT=/path/to/vault'
  )
}
