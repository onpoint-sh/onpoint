type ShortcutModifier = 'CommandOrControl' | 'Command' | 'Control' | 'Alt' | 'Shift' | 'Super'

type ResolvedModifier = 'Command' | 'Control' | 'Alt' | 'Shift' | 'Super'

type ParsedAccelerator = {
  modifiers: ShortcutModifier[]
  key: string
}

export type ShortcutPlatform = string

export type ShortcutKeyboardEventLike = {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const MODIFIER_ORDER: readonly ShortcutModifier[] = [
  'CommandOrControl',
  'Command',
  'Control',
  'Alt',
  'Shift',
  'Super'
]

const RESOLVED_MODIFIER_ORDER: readonly ResolvedModifier[] = [
  'Command',
  'Control',
  'Alt',
  'Shift',
  'Super'
]

const MODIFIER_ALIASES: Readonly<Record<string, ShortcutModifier>> = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  command: 'Command',
  cmd: 'Command',
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super'
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'Escape',
  escape: 'Escape',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Space',
  spacebar: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  up: 'Up',
  arrowup: 'Up',
  down: 'Down',
  arrowdown: 'Down',
  left: 'Left',
  arrowleft: 'Left',
  right: 'Right',
  arrowright: 'Right',
  plus: 'Plus',
  minus: 'Minus',
  comma: ',',
  backslash: '\\',
  equals: '=',
  _: 'Minus'
}

const EVENT_KEY_ALIASES: Readonly<Record<string, string>> = {
  enter: 'Enter',
  escape: 'Escape',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  ' ': 'Space',
  ',': ',',
  '\\': '\\',
  '=': '=',
  _: 'Minus',
  subtract: 'Minus',
  add: 'Plus'
}

const EVENT_CODE_ALIASES: Readonly<Record<string, string>> = {
  Minus: 'Minus',
  NumpadSubtract: 'Minus',
  Equal: '=',
  NumpadAdd: 'Plus',
  Comma: ',',
  Backslash: '\\'
}

const MODIFIER_ONLY_EVENT_KEYS = new Set([
  'shift',
  'control',
  'ctrl',
  'alt',
  'meta',
  'command',
  'os'
])

function normalizeModifierToken(token: string): ShortcutModifier | null {
  const normalizedToken = token.trim().toLowerCase()
  if (!normalizedToken) return null
  return MODIFIER_ALIASES[normalizedToken] ?? null
}

function normalizeKeyToken(token: string): string | null {
  const normalizedToken = token.trim()
  if (!normalizedToken) return null

  const lowered = normalizedToken.toLowerCase()

  if (KEY_ALIASES[lowered]) return KEY_ALIASES[lowered]
  if (/^[a-z]$/i.test(normalizedToken)) return normalizedToken.toUpperCase()
  if (/^[0-9]$/.test(normalizedToken)) return normalizedToken
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(normalizedToken)) return normalizedToken.toUpperCase()
  if (normalizedToken === '+') return 'Plus'
  if (normalizedToken === '-') return 'Minus'
  if (normalizedToken === ',') return ','
  if (normalizedToken === '\\') return '\\'
  if (normalizedToken === '=') return '='

  return null
}

function parseAccelerator(accelerator: string): ParsedAccelerator | null {
  const trimmedAccelerator = accelerator.trim()
  if (!trimmedAccelerator) return null

  const parts = trimmedAccelerator.split('+').map((part) => part.trim())
  if (parts.some((part) => part.length === 0)) return null

  const modifiers = new Set<ShortcutModifier>()
  let normalizedKey: string | null = null

  for (const part of parts) {
    const modifier = normalizeModifierToken(part)

    if (modifier) {
      if (modifiers.has(modifier)) return null
      modifiers.add(modifier)
      continue
    }

    const key = normalizeKeyToken(part)
    if (!key) return null
    if (normalizedKey) return null
    normalizedKey = key
  }

  if (!normalizedKey) return null

  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))

  return { modifiers: orderedModifiers, key: normalizedKey }
}

function serializeAccelerator(parsed: ParsedAccelerator): string {
  if (parsed.modifiers.length === 0) return parsed.key
  return `${parsed.modifiers.join('+')}+${parsed.key}`
}

function resolveModifier(modifier: ShortcutModifier, platform: ShortcutPlatform): ResolvedModifier {
  if (modifier === 'CommandOrControl') {
    return platform === 'darwin' ? 'Command' : 'Control'
  }

  return modifier
}

function normalizeEventKey(key: string, code?: string): string | null {
  if (code && EVENT_CODE_ALIASES[code]) {
    return EVENT_CODE_ALIASES[code]
  }

  if (!key) return null

  const lowered = key.toLowerCase()
  if (MODIFIER_ONLY_EVENT_KEYS.has(lowered)) return null

  if (EVENT_KEY_ALIASES[lowered]) return EVENT_KEY_ALIASES[lowered]
  if (/^[a-z]$/i.test(key)) return key.toUpperCase()
  if (/^[0-9]$/.test(key)) return key
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(key)) return key.toUpperCase()
  if (key === '+') return 'Plus'
  if (key === '-') return 'Minus'
  if (key === ',') return ','
  if (key === '\\') return '\\'
  if (key === '=') return '='

  return null
}

function shouldIgnoreShiftForLayoutSymbol(event: ShortcutKeyboardEventLike): boolean {
  if (!event.shiftKey) return false
  if (!event.code) return false

  const shiftedSymbolsByCode: Readonly<Record<string, string>> = {
    Minus: '_',
    Equal: '+',
    Comma: '<',
    Backslash: '|'
  }

  const shiftedSymbol = shiftedSymbolsByCode[event.code]
  if (!shiftedSymbol) return false

  return event.key === shiftedSymbol
}

function serializeSignature(modifiers: Set<ResolvedModifier>, key: string): string {
  const orderedModifiers = RESOLVED_MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))
  if (orderedModifiers.length === 0) return key
  return `${orderedModifiers.join('+')}+${key}`
}

export function normalizeAccelerator(accelerator: string): string | null {
  const parsed = parseAccelerator(accelerator)
  if (!parsed) return null
  return serializeAccelerator(parsed)
}

export function acceleratorToSignature(
  accelerator: string,
  platform: ShortcutPlatform
): string | null {
  const parsed = parseAccelerator(accelerator)
  if (!parsed) return null

  const modifiers = new Set<ResolvedModifier>()

  for (const modifier of parsed.modifiers) {
    modifiers.add(resolveModifier(modifier, platform))
  }

  return serializeSignature(modifiers, parsed.key)
}

export function eventToSignature(
  event: ShortcutKeyboardEventLike,
  platform: ShortcutPlatform
): string | null {
  const key = normalizeEventKey(event.key, event.code)
  if (!key) return null

  const modifiers = new Set<ResolvedModifier>()

  if (platform === 'darwin') {
    if (event.metaKey) modifiers.add('Command')
    if (event.ctrlKey) modifiers.add('Control')
  } else {
    if (event.ctrlKey) modifiers.add('Control')
    if (event.metaKey) modifiers.add('Super')
  }

  if (event.altKey) modifiers.add('Alt')
  if (event.shiftKey && !shouldIgnoreShiftForLayoutSymbol(event)) modifiers.add('Shift')

  return serializeSignature(modifiers, key)
}

export function matchesShortcutEvent(
  accelerator: string,
  event: ShortcutKeyboardEventLike,
  platform: ShortcutPlatform
): boolean {
  const acceleratorSignature = acceleratorToSignature(accelerator, platform)
  const eventSignature = eventToSignature(event, platform)

  if (!acceleratorSignature || !eventSignature) return false

  return acceleratorSignature === eventSignature
}

export function keyboardEventToAccelerator(
  event: ShortcutKeyboardEventLike,
  platform: ShortcutPlatform
): string | null {
  const key = normalizeEventKey(event.key, event.code)
  if (!key) return null

  const modifiers = new Set<ShortcutModifier>()

  if (platform === 'darwin') {
    if (event.metaKey) modifiers.add('CommandOrControl')
    if (event.ctrlKey) modifiers.add('Control')
  } else {
    if (event.ctrlKey) modifiers.add('CommandOrControl')
    if (event.metaKey) modifiers.add('Super')
  }

  if (event.altKey) modifiers.add('Alt')
  if (event.shiftKey && !shouldIgnoreShiftForLayoutSymbol(event)) modifiers.add('Shift')

  const accelerator = serializeAccelerator({
    modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
    key
  })

  return normalizeAccelerator(accelerator)
}
