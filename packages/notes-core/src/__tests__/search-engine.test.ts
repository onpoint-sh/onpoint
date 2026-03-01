import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listVaultNotes,
  saveVaultNote,
  searchVaultContent,
  searchVaultContentV2,
  searchVaultTitlesV2
} from '../vault-files'

const temporaryVaults: string[] = []

async function createVault(): Promise<string> {
  const tempPath = await mkdtemp(join(tmpdir(), 'onpoint-search-test-'))
  const vaultPath = await realpath(tempPath)
  temporaryVaults.push(vaultPath)
  return vaultPath
}

afterEach(async () => {
  await Promise.all(
    temporaryVaults.splice(0).map((vaultPath) => rm(vaultPath, { recursive: true, force: true }))
  )
})

describe('searchVaultContentV2', () => {
  it('searches non-markdown files (.yml, .yaml, .ts, .json, .txt)', async () => {
    const vaultPath = await createVault()
    await mkdir(join(vaultPath, 'src'), { recursive: true })

    await writeFile(join(vaultPath, 'alpha.yml'), 'kind: config\nneedle_yml: true\n', 'utf-8')
    await writeFile(join(vaultPath, 'bravo.yaml'), 'needle_yaml: true\n', 'utf-8')
    await writeFile(
      join(vaultPath, 'src', 'main.ts'),
      'export const value = "needle_ts"\n',
      'utf-8'
    )
    await writeFile(join(vaultPath, 'data.json'), '{"value":"needle_json"}\n', 'utf-8')
    await writeFile(join(vaultPath, 'notes.txt'), 'needle_txt\n', 'utf-8')

    const [yml, yaml, ts, json, txt] = await Promise.all([
      searchVaultContentV2(vaultPath, 'needle_yml'),
      searchVaultContentV2(vaultPath, 'needle_yaml'),
      searchVaultContentV2(vaultPath, 'needle_ts'),
      searchVaultContentV2(vaultPath, 'needle_json'),
      searchVaultContentV2(vaultPath, 'needle_txt')
    ])

    expect(yml.map((item) => item.relativePath)).toContain('alpha.yml')
    expect(yaml.map((item) => item.relativePath)).toContain('bravo.yaml')
    expect(ts.map((item) => item.relativePath)).toContain('src/main.ts')
    expect(json.map((item) => item.relativePath)).toContain('data.json')
    expect(txt.map((item) => item.relativePath)).toContain('notes.txt')
  })

  it('updates searchability immediately after save for yaml files', async () => {
    const vaultPath = await createVault()
    await writeFile(join(vaultPath, 'random.yml'), 'nice: before\n', 'utf-8')

    // Prime cache snapshot so we can verify save-path cache updates.
    await listVaultNotes(vaultPath)

    await saveVaultNote(vaultPath, 'random.yml', 'nice: after\nfresh_token_after_save: true\n')

    const results = await searchVaultContent(vaultPath, 'fresh_token_after_save')
    expect(results.map((item) => item.relativePath)).toContain('random.yml')
  })

  it('strips markdown frontmatter only for .md files, not yaml', async () => {
    const vaultPath = await createVault()

    await writeFile(
      join(vaultPath, 'doc.md'),
      '---\ntitle: md frontmatter token_md_frontmatter\n---\nbody without token\n',
      'utf-8'
    )
    await writeFile(
      join(vaultPath, 'config.yml'),
      '---\nneedle_yaml_frontmatter: true\n---\nactive: yes\n',
      'utf-8'
    )

    const yamlFrontmatterResults = await searchVaultContentV2(vaultPath, 'needle_yaml_frontmatter')
    const mdFrontmatterResults = await searchVaultContentV2(vaultPath, 'token_md_frontmatter')

    expect(yamlFrontmatterResults.map((item) => item.relativePath)).toContain('config.yml')
    expect(mdFrontmatterResults.map((item) => item.relativePath)).not.toContain('doc.md')
  })

  it('respects ignore files by default and supports includeIgnored override', async () => {
    const vaultPath = await createVault()

    await writeFile(join(vaultPath, '.gitignore'), 'ignored.yml\n', 'utf-8')
    await writeFile(join(vaultPath, 'ignored.yml'), 'hidden_token: true\n', 'utf-8')
    await writeFile(join(vaultPath, 'visible.yml'), 'visible_token: true\n', 'utf-8')

    const defaultResults = await searchVaultContentV2(vaultPath, 'hidden_token')
    const overrideResults = await searchVaultContentV2(vaultPath, 'hidden_token', {
      includeIgnored: true
    })

    expect(defaultResults).toHaveLength(0)
    expect(overrideResults.map((item) => item.relativePath)).toContain('ignored.yml')
  })

  it('applies include/exclude globs and file type filters deterministically', async () => {
    const vaultPath = await createVault()
    await mkdir(join(vaultPath, 'nested'), { recursive: true })

    await writeFile(join(vaultPath, 'root.yml'), 'token_glob: true\n', 'utf-8')
    await writeFile(join(vaultPath, 'nested', 'inner.yml'), 'token_glob: true\n', 'utf-8')
    await writeFile(join(vaultPath, 'nested', 'inner.ts'), 'const token_glob = true\n', 'utf-8')

    const yamlOnly = await searchVaultContentV2(vaultPath, 'token_glob', {
      fileTypes: ['yaml']
    })
    expect(yamlOnly.map((item) => item.relativePath).sort()).toEqual([
      'nested/inner.yml',
      'root.yml'
    ])

    const includeNested = await searchVaultContentV2(vaultPath, 'token_glob', {
      includeGlobs: ['nested/**']
    })
    expect(includeNested.map((item) => item.relativePath).sort()).toEqual([
      'nested/inner.ts',
      'nested/inner.yml'
    ])

    const excludeNested = await searchVaultContentV2(vaultPath, 'token_glob', {
      excludeGlobs: ['nested/**']
    })
    expect(excludeNested.map((item) => item.relativePath)).toEqual(['root.yml'])
  })

  it('skips binary files during search', async () => {
    const vaultPath = await createVault()

    await writeFile(join(vaultPath, 'binary.dat'), Buffer.from('binary_token\0\0\0', 'utf-8'))
    await writeFile(join(vaultPath, 'plain.txt'), 'binary_token\n', 'utf-8')

    const results = await searchVaultContentV2(vaultPath, 'binary_token')
    const paths = results.map((item) => item.relativePath)

    expect(paths).toContain('plain.txt')
    expect(paths).not.toContain('binary.dat')
  })
})

describe('searchVaultTitlesV2', () => {
  it('respects file filters and ranking for title/path search', async () => {
    const vaultPath = await createVault()
    await mkdir(join(vaultPath, 'nested'), { recursive: true })

    await writeFile(join(vaultPath, 'Alpha.md'), '---\ntitle: Alpha Document\n---\nBody\n', 'utf-8')
    await writeFile(join(vaultPath, 'nested', 'AlphaConfig.yml'), 'name: alpha\n', 'utf-8')
    await writeFile(join(vaultPath, 'nested', 'Alpha.ts'), 'export const alpha = 1\n', 'utf-8')

    const results = await searchVaultTitlesV2(vaultPath, 'Alpha', {
      fileTypes: ['yaml', 'md'],
      includeGlobs: ['**/Alpha*']
    })

    expect(results.map((item) => item.relativePath).sort()).toEqual([
      'Alpha.md',
      'nested/AlphaConfig.yml'
    ])
    expect(results[0].score).toBeGreaterThan(0)
  })
})
