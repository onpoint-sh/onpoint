import { BrowserWindow } from 'electron'
import {
  SHORTCUT_ACTION_IDS,
  SHORTCUT_DEFINITIONS_BY_ID,
  SHORTCUT_IPC_CHANNELS,
  getDefaultShortcutProfile,
  isShortcutActionId,
  normalizeShortcutWhen,
  type ShortcutActionId,
  type ShortcutOverrides,
  type ShortcutProfile,
  type ShortcutRule,
  type ShortcutRuleImport,
  type ShortcutRulePatch,
  type ShortcutUpdateResult
} from '@onpoint/shared/shortcuts'
import { validateShortcutWhenExpression } from '@onpoint/shared/shortcut-when'
import { validateShortcutProfile } from './conflicts'
import { GlobalShortcutRuntime } from './global-runtime'
import { registerShortcutsIpc } from './ipc'
import { normalizeAccelerator } from './normalize'
import { loadShortcutOverrides, saveShortcutOverrides } from './store'

type ShortcutServiceOptions = {
  getWindows: () => BrowserWindow[]
  onGlobalAction: (actionId: ShortcutActionId) => void
}

type ShortcutService = {
  initialize: () => Promise<void>
  list: () => ShortcutProfile
  update: (actionId: ShortcutActionId, patch: ShortcutRulePatch) => Promise<ShortcutUpdateResult>
  reset: (actionId: ShortcutActionId) => Promise<void>
  resetAll: () => Promise<void>
  replaceAll: (rules: ShortcutRuleImport[]) => Promise<ShortcutUpdateResult>
  execute: (actionId: ShortcutActionId) => Promise<void>
  dispose: () => void
}

function cloneProfile(profile: ShortcutProfile): ShortcutProfile {
  return {
    rules: SHORTCUT_ACTION_IDS.reduce<ShortcutProfile['rules']>(
      (rules, actionId) => {
        rules[actionId] = { ...profile.rules[actionId] }
        return rules
      },
      {} as ShortcutProfile['rules']
    )
  }
}

function buildProfile(
  defaultProfile: ShortcutProfile,
  overrides: ShortcutOverrides
): ShortcutProfile {
  const rules = SHORTCUT_ACTION_IDS.reduce<ShortcutProfile['rules']>(
    (accumulator, actionId) => {
      const defaultRule = defaultProfile.rules[actionId]
      const override = overrides[actionId]

      const normalizedAccelerator =
        typeof override?.accelerator === 'string'
          ? normalizeAccelerator(override.accelerator)
          : undefined
      const nextAccelerator = normalizedAccelerator ?? defaultRule.accelerator

      const nextScope = override?.scope ?? defaultRule.scope
      const nextWhen =
        override && Object.prototype.hasOwnProperty.call(override, 'when')
          ? normalizeShortcutWhen(override.when)
          : defaultRule.when

      const isCustomized =
        nextAccelerator !== defaultRule.accelerator ||
        nextScope !== defaultRule.scope ||
        normalizeShortcutWhen(nextWhen) !== normalizeShortcutWhen(defaultRule.when)

      accumulator[actionId] = {
        actionId,
        accelerator: nextAccelerator,
        scope: nextScope,
        when: nextWhen,
        source: isCustomized ? 'user' : 'system'
      }

      return accumulator
    },
    {} as ShortcutProfile['rules']
  )

  return { rules }
}

function buildOverrides(
  defaultProfile: ShortcutProfile,
  profile: ShortcutProfile
): ShortcutOverrides {
  const overrides: ShortcutOverrides = {}

  for (const actionId of SHORTCUT_ACTION_IDS) {
    const defaultRule = defaultProfile.rules[actionId]
    const rule = profile.rules[actionId]

    const normalizedAccelerator = normalizeAccelerator(rule.accelerator) ?? defaultRule.accelerator
    const normalizedWhen = normalizeShortcutWhen(rule.when)

    const override: NonNullable<ShortcutOverrides[ShortcutActionId]> = {}

    if (normalizedAccelerator !== defaultRule.accelerator) {
      override.accelerator = normalizedAccelerator
    }

    if (rule.scope !== defaultRule.scope) {
      override.scope = rule.scope
    }

    if (
      normalizedWhen !== normalizeShortcutWhen(defaultRule.when) &&
      typeof normalizedWhen === 'string'
    ) {
      override.when = normalizedWhen
    }

    if (override.accelerator || override.scope || typeof override.when === 'string') {
      overrides[actionId] = override
    }
  }

  return overrides
}

function getGlobalRules(profile: ShortcutProfile): ShortcutRule[] {
  const globalRules: ShortcutRule[] = []

  for (const actionId of SHORTCUT_ACTION_IDS) {
    const rule = profile.rules[actionId]
    if (rule.scope === 'global') {
      globalRules.push(rule)
    }
  }

  return globalRules
}

function validateRuleSchema(profile: ShortcutProfile): ShortcutUpdateResult {
  for (const actionId of SHORTCUT_ACTION_IDS) {
    const definition = SHORTCUT_DEFINITIONS_BY_ID[actionId]
    const rule = profile.rules[actionId]

    if (!rule) {
      return {
        ok: false,
        reason: `Shortcut for "${definition.label}" is missing.`
      }
    }

    const normalizedAccelerator = normalizeAccelerator(rule.accelerator)

    if (!normalizedAccelerator) {
      return {
        ok: false,
        reason: `Shortcut for "${definition.label}" is invalid. Use a key combination like CommandOrControl+B.`
      }
    }

    if (!definition.allowedScopes.includes(rule.scope)) {
      return {
        ok: false,
        reason: `"${definition.label}" does not support ${rule.scope} scope.`
      }
    }

    const normalizedWhen = normalizeShortcutWhen(rule.when)

    if (normalizedWhen) {
      const whenValidation = validateShortcutWhenExpression(normalizedWhen)
      if (!whenValidation.ok) {
        return {
          ok: false,
          reason: `Invalid "when" expression for "${definition.label}": ${whenValidation.reason}`
        }
      }
    }
  }

  return { ok: true }
}

function normalizeImportedRule(rule: ShortcutRuleImport): ShortcutRuleImport {
  return {
    command: rule.command,
    key: rule.key,
    scope: rule.scope,
    when: normalizeShortcutWhen(rule.when)
  }
}

export function createShortcutService(options: ShortcutServiceOptions): ShortcutService {
  const defaultProfile = getDefaultShortcutProfile()

  let profile = cloneProfile(defaultProfile)
  let overrides: ShortcutOverrides = {}
  let isDisposed = false
  let unregisterIpcHandlers: (() => void) | null = null

  const runtime = new GlobalShortcutRuntime({
    onAction: (actionId) => {
      options.onGlobalAction(actionId)
      emitGlobalAction(actionId)
    }
  })

  function list(): ShortcutProfile {
    return cloneProfile(profile)
  }

  function emitBindingsChanged(): void {
    for (const window of options.getWindows()) {
      if (window.isDestroyed()) continue
      window.webContents.send(SHORTCUT_IPC_CHANNELS.bindingsChanged, list())
    }
  }

  function emitGlobalAction(actionId: ShortcutActionId): void {
    const focusedWindow = BrowserWindow.getFocusedWindow()

    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.webContents.send(SHORTCUT_IPC_CHANNELS.globalAction, actionId)
      return
    }

    const [primaryWindow] = options.getWindows()
    if (!primaryWindow || primaryWindow.isDestroyed()) return
    primaryWindow.webContents.send(SHORTCUT_IPC_CHANNELS.globalAction, actionId)
  }

  async function applyProfile(nextProfile: ShortcutProfile): Promise<ShortcutUpdateResult> {
    const schemaValidation = validateRuleSchema(nextProfile)

    if (!schemaValidation.ok) {
      return schemaValidation
    }

    const validation = validateShortcutProfile(nextProfile)

    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
        conflictWith: validation.conflictWith
      }
    }

    const previousProfile = profile
    const previousOverrides = overrides

    const applyGlobalsResult = runtime.apply(getGlobalRules(nextProfile))

    if (!applyGlobalsResult.ok) {
      return {
        ok: false,
        reason: applyGlobalsResult.reason
      }
    }

    const nextOverrides = buildOverrides(defaultProfile, nextProfile)
    const normalizedProfile = buildProfile(defaultProfile, nextOverrides)

    profile = normalizedProfile
    overrides = nextOverrides

    try {
      await saveShortcutOverrides(nextOverrides)
    } catch (error) {
      console.error('Failed to persist shortcut settings.', error)
      runtime.apply(getGlobalRules(previousProfile))
      profile = previousProfile
      overrides = previousOverrides
      return {
        ok: false,
        reason: 'Failed to persist shortcuts. Please try again.'
      }
    }

    emitBindingsChanged()
    return { ok: true }
  }

  async function initialize(): Promise<void> {
    if (isDisposed) return

    unregisterIpcHandlers = registerShortcutsIpc({
      list,
      update,
      reset,
      resetAll,
      replaceAll,
      execute
    })

    const loaded = await loadShortcutOverrides()
    const loadedProfile = buildProfile(defaultProfile, loaded.overrides)
    const applyResult = await applyProfile(loadedProfile)

    if (!applyResult.ok) {
      profile = cloneProfile(defaultProfile)
      overrides = {}
      runtime.apply(getGlobalRules(defaultProfile))
      await saveShortcutOverrides({})
      return
    }

    if (loaded.needsRewrite) {
      await saveShortcutOverrides(overrides)
    }
  }

  async function update(
    actionId: ShortcutActionId,
    patch: ShortcutRulePatch
  ): Promise<ShortcutUpdateResult> {
    if (!isShortcutActionId(actionId)) {
      return {
        ok: false,
        reason: 'Unknown shortcut action.'
      }
    }

    if (!patch || typeof patch !== 'object') {
      return {
        ok: false,
        reason: 'Shortcut update payload is invalid.'
      }
    }

    const currentRule = profile.rules[actionId]

    const nextRule: ShortcutRule = {
      ...currentRule,
      accelerator:
        typeof patch.accelerator === 'string' ? patch.accelerator : currentRule.accelerator,
      scope: patch.scope ?? currentRule.scope,
      when:
        patch.when !== undefined
          ? normalizeShortcutWhen(patch.when)
          : normalizeShortcutWhen(currentRule.when)
    }

    const nextProfile = cloneProfile(profile)
    nextProfile.rules[actionId] = nextRule

    return applyProfile(nextProfile)
  }

  async function replaceAll(rules: ShortcutRuleImport[]): Promise<ShortcutUpdateResult> {
    if (!Array.isArray(rules)) {
      return {
        ok: false,
        reason: 'Shortcut import payload is invalid.'
      }
    }

    const byActionId = new Map<ShortcutActionId, ShortcutRuleImport>()

    for (const inputRule of rules) {
      if (!inputRule || typeof inputRule !== 'object') {
        return {
          ok: false,
          reason: 'Shortcut import payload is invalid.'
        }
      }

      if (!isShortcutActionId(inputRule.command)) {
        return {
          ok: false,
          reason: `Unknown shortcut action "${String(inputRule.command)}".`
        }
      }

      if (byActionId.has(inputRule.command)) {
        return {
          ok: false,
          reason: `Duplicate shortcut rule for "${inputRule.command}".`
        }
      }

      byActionId.set(inputRule.command, normalizeImportedRule(inputRule))
    }

    for (const actionId of SHORTCUT_ACTION_IDS) {
      if (!byActionId.has(actionId)) {
        return {
          ok: false,
          reason: `Missing shortcut rule for "${actionId}".`
        }
      }
    }

    const nextProfile = cloneProfile(profile)

    for (const actionId of SHORTCUT_ACTION_IDS) {
      const inputRule = byActionId.get(actionId)!
      nextProfile.rules[actionId] = {
        actionId,
        accelerator: inputRule.key,
        scope: inputRule.scope,
        when: normalizeShortcutWhen(inputRule.when),
        source: 'user'
      }
    }

    return applyProfile(nextProfile)
  }

  async function reset(actionId: ShortcutActionId): Promise<void> {
    if (!isShortcutActionId(actionId)) {
      throw new Error('Unknown shortcut action.')
    }

    const nextProfile = cloneProfile(profile)
    nextProfile.rules[actionId] = { ...defaultProfile.rules[actionId] }

    const result = await applyProfile(nextProfile)

    if (!result.ok) {
      throw new Error(result.reason)
    }
  }

  async function resetAll(): Promise<void> {
    const result = await applyProfile(defaultProfile)

    if (!result.ok) {
      throw new Error(result.reason)
    }
  }

  async function execute(actionId: ShortcutActionId): Promise<void> {
    if (!isShortcutActionId(actionId)) {
      throw new Error('Unknown shortcut action.')
    }

    const definition = SHORTCUT_DEFINITIONS_BY_ID[actionId]
    if (!definition.allowedScopes.includes('global')) {
      throw new Error(`Shortcut action "${actionId}" cannot be executed directly.`)
    }

    options.onGlobalAction(actionId)
  }

  function dispose(): void {
    if (isDisposed) return
    isDisposed = true
    runtime.dispose()
    unregisterIpcHandlers?.()
    unregisterIpcHandlers = null
  }

  return {
    initialize,
    list,
    update,
    reset,
    resetAll,
    replaceAll,
    execute,
    dispose
  }
}

export type { ShortcutService }
