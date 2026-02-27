export type FormatOptions = {
  json?: boolean
}

export function formatOutput<T>(
  data: T,
  options: FormatOptions,
  formatters: {
    human: (data: T) => void
  }
): void {
  if (options.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
    return
  }
  formatters.human(data)
}

export function formatError(error: unknown, options: FormatOptions): void {
  const message = error instanceof Error ? error.message : String(error)
  if (options.json) {
    process.stderr.write(JSON.stringify({ error: message }) + '\n')
  } else {
    process.stderr.write(`Error: ${message}\n`)
  }
}
