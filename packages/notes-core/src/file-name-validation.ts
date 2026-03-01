const INVALID_WINDOWS_CHARS = /[\\/:*?"<>|]/g
const INVALID_POSIX_CHARS = /[/]/g
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|clock\$|nul|lpt[0-9]|com[0-9])(\.(.*?))?$/i

export type TreeNameValidationSeverity = 'error' | 'warning'

export type TreeNameValidationCode =
  | 'empty'
  | 'starts_with_slash'
  | 'already_exists'
  | 'invalid_name'
  | 'leading_trailing_whitespace'

export type TreeNameValidationResult = {
  severity: TreeNameValidationSeverity
  code: TreeNameValidationCode
  message: string
  normalizedName: string
  proposedPath: string
}

export type ValidateProposedTreeNameInput = {
  proposedName: string
  parentPath?: string | null
  currentPath?: string | null
  existingPaths?: Iterable<string>
  isWindows?: boolean
}

export function normalizeProposedName(value: string): string {
  if (typeof value !== 'string') return ''

  // VS Code normalizes tabs and trailing separators before validating.
  return value.replace(/\t+/g, '').replace(/[\\/]+$/g, '')
}

function normalizePathForComparison(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

function safeIsWindowsDefault(): boolean {
  return typeof process !== 'undefined' && process.platform === 'win32'
}

type BasenameValidationOptions = {
  allowLeadingTrailingWhitespace?: boolean
}

export function isValidBasename(
  basename: string,
  isWindows = safeIsWindowsDefault(),
  options: BasenameValidationOptions = {}
): boolean {
  const { allowLeadingTrailingWhitespace = true } = options
  const invalidCharPattern = isWindows ? INVALID_WINDOWS_CHARS : INVALID_POSIX_CHARS

  if (!basename || basename.length === 0 || /^\s+$/.test(basename)) return false

  invalidCharPattern.lastIndex = 0
  if (invalidCharPattern.test(basename)) return false

  if (isWindows && WINDOWS_RESERVED_NAMES.test(basename)) return false
  if (basename === '.' || basename === '..') return false
  if (isWindows && basename[basename.length - 1] === '.') return false
  if (!allowLeadingTrailingWhitespace && basename.length !== basename.trim().length) return false
  if (basename.length > 255) return false

  return true
}

function createResult(
  severity: TreeNameValidationSeverity,
  code: TreeNameValidationCode,
  message: string,
  normalizedName: string,
  proposedPath: string
): TreeNameValidationResult {
  return { severity, code, message, normalizedName, proposedPath }
}

function escapeMessageName(name: string): string {
  return name.replace(/\*/g, '\\*')
}

export function validateProposedTreeName(
  input: ValidateProposedTreeNameInput
): TreeNameValidationResult | null {
  const normalizedName = normalizeProposedName(input.proposedName)
  const parentPath = input.parentPath ? normalizePathForComparison(input.parentPath) : ''
  const namePath = normalizedName.replace(/\\/g, '/')
  const proposedPath = parentPath ? `${parentPath}/${namePath}` : namePath
  const normalizedProposedPath = normalizePathForComparison(proposedPath)
  const normalizedCurrentPath = input.currentPath
    ? normalizePathForComparison(input.currentPath)
    : null
  const isWindows = input.isWindows ?? safeIsWindowsDefault()

  if (!normalizedName || /^\s+$/.test(normalizedName)) {
    return createResult(
      'error',
      'empty',
      'A file or folder name must be provided.',
      normalizedName,
      normalizedProposedPath
    )
  }

  if (normalizedName[0] === '/' || normalizedName[0] === '\\') {
    return createResult(
      'error',
      'starts_with_slash',
      'A file or folder name cannot start with a slash.',
      normalizedName,
      normalizedProposedPath
    )
  }

  if (input.existingPaths) {
    for (const existingPath of input.existingPaths) {
      const normalizedExistingPath = normalizePathForComparison(existingPath)
      if (
        normalizedExistingPath === normalizedProposedPath &&
        normalizedExistingPath !== normalizedCurrentPath
      ) {
        return createResult(
          'error',
          'already_exists',
          `A file or folder "${escapeMessageName(normalizedName)}" already exists at this location. Please choose a different name.`,
          normalizedName,
          normalizedProposedPath
        )
      }
    }
  }

  const segments = normalizedName.split(/[\\/]/)
  const hasInvalidSegment = segments.some(
    (segment) => !isValidBasename(segment, isWindows, { allowLeadingTrailingWhitespace: true })
  )

  if (hasInvalidSegment) {
    return createResult(
      'error',
      'invalid_name',
      `The name "${escapeMessageName(normalizedName)}" is not valid as a file or folder name. Please choose a different name.`,
      normalizedName,
      normalizedProposedPath
    )
  }

  const hasLeadingOrTrailingWhitespace = segments.some((segment) => /^\s|\s$/.test(segment))
  if (hasLeadingOrTrailingWhitespace) {
    return createResult(
      'warning',
      'leading_trailing_whitespace',
      'Leading or trailing whitespace detected in file or folder name.',
      normalizedName,
      normalizedProposedPath
    )
  }

  return null
}
