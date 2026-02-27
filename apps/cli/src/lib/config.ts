import { join } from 'node:path'
import { homedir } from 'node:os'
import { promises as fs } from 'node:fs'

type CliConfig = {
  version: 1
  defaultVault: string | null
}

const DEFAULT_CONFIG: CliConfig = {
  version: 1,
  defaultVault: null
}

function getConfigDir(): string {
  return process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'onpoint')
    : join(homedir(), '.config', 'onpoint')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json')
}

export async function loadCliConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveCliConfig(config: CliConfig): Promise<void> {
  const dir = getConfigDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(join(dir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8')
}
