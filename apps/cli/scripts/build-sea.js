#!/usr/bin/env node

/**
 * Build a standalone binary for the onpoint CLI using Node.js SEA.
 *
 * Steps:
 *   1. Bundle TS → single CJS file via esbuild
 *   2. Generate SEA preparation blob
 *   3. Copy the node binary
 *   4. Remove macOS code signature (if on macOS)
 *   5. Inject the blob with postject
 *   6. Re-sign on macOS
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, chmodSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliRoot = join(__dirname, '..')
const distDir = join(cliRoot, 'dist')
const binDir = join(cliRoot, 'node_modules', '.bin')
const platform = process.platform
const blobPath = join(distDir, 'sea-prep.blob')
const binaryName = platform === 'win32' ? 'onpoint.exe' : 'onpoint'
const outputBinary = join(distDir, binaryName)

mkdirSync(distDir, { recursive: true })

// 1. Bundle with esbuild
const esbuildBin = join(binDir, 'esbuild')
if (!existsSync(esbuildBin)) {
  console.error(`esbuild binary not found at ${esbuildBin}. Run 'pnpm install' first.`)
  process.exit(1)
}
console.log('Bundling with esbuild...')
execFileSync(
  esbuildBin,
  ['src/index.ts', '--bundle', '--platform=node', '--format=cjs', '--outfile=dist/onpoint.cjs'],
  {
    cwd: cliRoot,
    stdio: 'inherit'
  }
)

// 2. Generate SEA blob
console.log('Generating SEA blob...')
execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], {
  cwd: cliRoot,
  stdio: 'inherit'
})

// 3. Copy node binary
console.log('Copying node binary...')
copyFileSync(process.execPath, outputBinary)
chmodSync(outputBinary, 0o755)

// 4. Remove macOS signature (required before injection)
if (platform === 'darwin') {
  console.log('Removing macOS code signature...')
  execFileSync('codesign', ['--remove-signature', outputBinary])
}

// 5. Inject blob with postject
const postjectBin = join(binDir, 'postject')
if (!existsSync(postjectBin)) {
  console.error(`postject binary not found at ${postjectBin}. Run 'pnpm install' first.`)
  process.exit(1)
}
if (!existsSync(blobPath)) {
  console.error(`SEA blob not found at ${blobPath}. SEA preparation step may have failed.`)
  process.exit(1)
}
console.log('Injecting SEA blob...')
const postjectArgs = [
  outputBinary,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
]
if (platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA')
}
execFileSync(postjectBin, postjectArgs, {
  cwd: cliRoot,
  stdio: 'inherit'
})

// 6. Re-sign on macOS
if (platform === 'darwin') {
  console.log('Code signing...')
  execFileSync('codesign', ['--sign', '-', outputBinary])
}

console.log(`\nBinary built: ${outputBinary}`)
console.log(`Test it: ${outputBinary} --help`)
