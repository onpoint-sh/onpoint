export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  NO_VAULT: 2,
  NOT_FOUND: 3,
  INVALID_INPUT: 4
} as const

export function handleError(error: unknown, options: { json?: boolean }): never {
  const message = error instanceof Error ? error.message : String(error)
  if (options.json) {
    process.stderr.write(JSON.stringify({ error: message }) + '\n')
  } else {
    process.stderr.write(`Error: ${message}\n`)
  }
  process.exit(EXIT_CODES.GENERAL_ERROR)
}
