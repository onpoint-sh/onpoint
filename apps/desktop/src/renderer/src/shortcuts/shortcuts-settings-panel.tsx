import { LoaderCircle, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  acceleratorToSignature,
  keyboardEventToAccelerator
} from '@onpoint/shared/shortcut-accelerator'
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_WHEN_PRESETS_BY_ID,
  isShortcutActionId,
  type ShortcutActionId,
  type ShortcutProfile,
  type ShortcutRuleImport,
  type ShortcutWhenPresetId
} from '@onpoint/shared/shortcuts'
import { Button } from '@onpoint/ui/button'
import { useShortcutSettingsStore } from './shortcut-settings-store'

type ShortcutsSettingsPanelProps = {
  profile: ShortcutProfile
  isLoading: boolean
}

type AdvancedImportRule = {
  command: string
  key: string
  scope: string
  when?: string
}

function scopeLabel(scope: 'window' | 'global'): string {
  return scope === 'global' ? 'Global' : 'Window'
}

function isShortcutScope(scope: unknown): scope is 'window' | 'global' {
  return scope === 'window' || scope === 'global'
}

function presetLabel(when: string | undefined): string {
  if (!when) return 'Always'

  for (const preset of Object.values(SHORTCUT_WHEN_PRESETS_BY_ID)) {
    if (preset.when === when) {
      return preset.label
    }
  }

  return 'Custom expression'
}

function getPresetIdByWhen(when: string | undefined): ShortcutWhenPresetId | null {
  if (!when) return null

  for (const preset of Object.values(SHORTCUT_WHEN_PRESETS_BY_ID)) {
    if (preset.when === when) {
      return preset.id
    }
  }

  return null
}

function formatShortcutToken(token: string, platform: string): string {
  const macLabels: Record<string, string> = {
    Command: '⌘',
    Control: '⌃',
    Alt: '⌥',
    Shift: '⇧',
    Super: '⌘',
    Enter: '↩',
    Tab: '⇥',
    Escape: 'Esc',
    Space: 'Space',
    Up: '↑',
    Down: '↓',
    Left: '←',
    Right: '→',
    Backspace: '⌫',
    Delete: '⌦',
    Plus: '+',
    Minus: '-'
  }

  const defaultLabels: Record<string, string> = {
    Command: 'Cmd',
    Control: 'Ctrl',
    Alt: 'Alt',
    Shift: 'Shift',
    Super: 'Super',
    Enter: 'Enter',
    Tab: 'Tab',
    Escape: 'Esc',
    Space: 'Space',
    Up: 'Up',
    Down: 'Down',
    Left: 'Left',
    Right: 'Right',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Plus: '+',
    Minus: '-'
  }

  const dictionary = platform === 'darwin' ? macLabels : defaultLabels
  if (dictionary[token]) return dictionary[token]
  if (token.length === 1) return token.toUpperCase()
  return token
}

function acceleratorToDisplayTokens(accelerator: string, platform: string): string[] {
  const resolvedAccelerator = acceleratorToSignature(accelerator, platform) ?? accelerator
  return resolvedAccelerator
    .split('+')
    .map((token) => formatShortcutToken(token, platform))
    .filter((token) => token.length > 0)
}

function exportRulesToJson(profile: ShortcutProfile): string {
  const rules: ShortcutRuleImport[] = SHORTCUT_DEFINITIONS.map((definition) => {
    const rule = profile.rules[definition.id]
    return {
      command: definition.id,
      key: rule.accelerator,
      scope: rule.scope,
      when: rule.when
    }
  })

  return JSON.stringify(rules, null, 2)
}

function parseAdvancedRules(value: string): ShortcutRuleImport[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Advanced JSON is not valid JSON.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Advanced JSON must be an array of shortcut rules.')
  }

  const rules: ShortcutRuleImport[] = []
  const seenActions = new Set<ShortcutActionId>()

  for (const item of parsed as AdvancedImportRule[]) {
    if (!item || typeof item !== 'object') {
      throw new Error('Each shortcut rule must be an object.')
    }

    if (!isShortcutActionId(item.command)) {
      throw new Error(`Unknown command "${String(item.command)}".`)
    }

    if (seenActions.has(item.command)) {
      throw new Error(`Duplicate command "${item.command}".`)
    }

    if (typeof item.key !== 'string' || item.key.trim().length === 0) {
      throw new Error(`Command "${item.command}" has an invalid key.`)
    }

    if (!isShortcutScope(item.scope)) {
      throw new Error(`Command "${item.command}" has an invalid scope.`)
    }

    if (item.when !== undefined && typeof item.when !== 'string') {
      throw new Error(`Command "${item.command}" has an invalid when expression.`)
    }

    rules.push({
      command: item.command,
      key: item.key,
      scope: item.scope,
      when: item.when
    })
    seenActions.add(item.command)
  }

  for (const definition of SHORTCUT_DEFINITIONS) {
    if (!seenActions.has(definition.id)) {
      throw new Error(`Missing command "${definition.id}".`)
    }
  }

  return rules
}

function ShortcutsSettingsPanel({
  profile,
  isLoading
}: ShortcutsSettingsPanelProps): React.JSX.Element {
  const platform = window.windowControls.platform
  const [searchValue, setSearchValue] = useState('')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [advancedValue, setAdvancedValue] = useState('')
  const [advancedError, setAdvancedError] = useState<string | null>(null)

  const editingActionId = useShortcutSettingsStore((state) => state.editingActionId)
  const pendingActionId = useShortcutSettingsStore((state) => state.pendingActionId)
  const errorByAction = useShortcutSettingsStore((state) => state.errorByAction)
  const setEditingActionId = useShortcutSettingsStore((state) => state.setEditingActionId)
  const setPendingActionId = useShortcutSettingsStore((state) => state.setPendingActionId)
  const setError = useShortcutSettingsStore((state) => state.setError)
  const clearErrors = useShortcutSettingsStore((state) => state.clearErrors)

  const definitions = useMemo(() => SHORTCUT_DEFINITIONS, [])
  const filteredDefinitions = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase()
    if (!normalizedQuery) return definitions

    return definitions.filter((definition) => {
      const rule = profile.rules[definition.id]
      return (
        definition.label.toLowerCase().includes(normalizedQuery) ||
        definition.description.toLowerCase().includes(normalizedQuery) ||
        rule.scope.toLowerCase().includes(normalizedQuery) ||
        (rule.when ?? '').toLowerCase().includes(normalizedQuery) ||
        definition.defaultAccelerator.toLowerCase().includes(normalizedQuery) ||
        rule.accelerator.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [definitions, profile, searchValue])

  const handleStartCapture = (actionId: ShortcutActionId): void => {
    clearErrors()
    setEditingActionId(actionId)
  }

  const handleCancelCapture = (): void => {
    setEditingActionId(null)
  }

  const handleCaptureKeyDown = async (
    event: React.KeyboardEvent<HTMLButtonElement>,
    actionId: ShortcutActionId
  ): Promise<void> => {
    if (event.repeat) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setError(actionId, null)
      setEditingActionId(null)
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const accelerator = keyboardEventToAccelerator(event.nativeEvent, platform)

    if (!accelerator) {
      setError(actionId, 'Unable to detect a valid shortcut from that key press.')
      return
    }

    setPendingActionId(actionId)

    try {
      const result = await window.shortcuts.update(actionId, { accelerator })

      if (!result.ok) {
        setError(actionId, result.reason)
        return
      }

      setError(actionId, null)
      setEditingActionId(null)
    } finally {
      setPendingActionId(null)
    }
  }

  const handleScopeChange = async (
    actionId: ShortcutActionId,
    scope: 'window' | 'global'
  ): Promise<void> => {
    setPendingActionId(actionId)
    setError(actionId, null)

    try {
      const result = await window.shortcuts.update(actionId, { scope })
      if (!result.ok) {
        setError(actionId, result.reason)
      }
    } finally {
      setPendingActionId(null)
    }
  }

  const handleWhenPresetChange = async (
    actionId: ShortcutActionId,
    presetId: ShortcutWhenPresetId
  ): Promise<void> => {
    const preset = SHORTCUT_WHEN_PRESETS_BY_ID[presetId]

    setPendingActionId(actionId)
    setError(actionId, null)

    try {
      const result = await window.shortcuts.update(actionId, { when: preset.when })
      if (!result.ok) {
        setError(actionId, result.reason)
      }
    } finally {
      setPendingActionId(null)
    }
  }

  const handleResetShortcut = async (actionId: ShortcutActionId): Promise<void> => {
    setPendingActionId(actionId)
    setError(actionId, null)

    try {
      await window.shortcuts.reset(actionId)
      setEditingActionId(null)
    } catch (error) {
      setError(actionId, (error as Error).message)
    } finally {
      setPendingActionId(null)
    }
  }

  const handleResetAll = async (): Promise<void> => {
    setPendingActionId('all')
    clearErrors()

    try {
      await window.shortcuts.resetAll()
      setEditingActionId(null)
    } catch (error) {
      setError('toggle_sidebar', (error as Error).message)
    } finally {
      setPendingActionId(null)
    }
  }

  const handleOpenAdvanced = (): void => {
    setAdvancedError(null)
    setAdvancedValue(exportRulesToJson(profile))
    setIsAdvancedOpen(true)
  }

  const handleApplyAdvanced = async (): Promise<void> => {
    setAdvancedError(null)

    let rules: ShortcutRuleImport[]

    try {
      rules = parseAdvancedRules(advancedValue)
    } catch (error) {
      setAdvancedError((error as Error).message)
      return
    }

    setPendingActionId('all')
    clearErrors()

    try {
      const result = await window.shortcuts.replaceAll(rules)
      if (!result.ok) {
        setAdvancedError(result.reason)
        return
      }

      setIsAdvancedOpen(false)
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <section className="shortcuts-vscode-panel">
      <div className="shortcuts-vscode-header">
        <label className="shortcuts-vscode-search">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="shortcuts-vscode-search-input"
            placeholder="Search keyboard shortcuts"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <div className="shortcuts-vscode-actions">
          <span className="shortcuts-vscode-count">
            {filteredDefinitions.length} {filteredDefinitions.length === 1 ? 'result' : 'results'}
          </span>
          <p className="shortcuts-vscode-subtitle">Press Enter to capture, Escape to cancel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="settings-pill-button"
            onClick={handleOpenAdvanced}
            disabled={isLoading || pendingActionId !== null}
          >
            Advanced JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="settings-pill-button shortcuts-vscode-reset-all"
            onClick={() => void handleResetAll()}
            disabled={isLoading || pendingActionId !== null}
          >
            <RotateCcw className="size-4" />
            Reset all
          </Button>
        </div>
      </div>

      {filteredDefinitions.length === 0 ? (
        <p className="shortcuts-no-results">No shortcuts match &quot;{searchValue}&quot;.</p>
      ) : null}

      <div className="shortcuts-vscode-list">
        {filteredDefinitions.map((definition) => {
          const isEditing = editingActionId === definition.id
          const isPending = pendingActionId === definition.id
          const isAnyPending = pendingActionId !== null
          const rule = profile.rules[definition.id]
          const defaultBinding = definition.defaultAccelerator
          const isCustomized = rule.source === 'user'
          const errorMessage = errorByAction[definition.id]
          const bindingDisplayTokens = acceleratorToDisplayTokens(rule.accelerator, platform)
          const defaultDisplayTokens = acceleratorToDisplayTokens(defaultBinding, platform)
          const selectedPresetId = getPresetIdByWhen(rule.when)

          return (
            <article
              key={definition.id}
              className="shortcuts-vscode-row"
              data-editing={isEditing ? 'true' : undefined}
              data-error={errorMessage ? 'true' : undefined}
            >
              <div className="shortcuts-vscode-main">
                <p className="shortcuts-command-title">
                  {definition.label}
                  <span className="shortcuts-scope-pill">{scopeLabel(rule.scope)}</span>
                </p>
                <p className="shortcuts-command-description">{definition.description}</p>
                <p className="shortcuts-default">
                  Default:{' '}
                  {defaultDisplayTokens.map((token, index) => (
                    <kbd
                      key={`${definition.id}-default-${token}-${index}`}
                      className="shortcuts-keycap"
                    >
                      {token}
                    </kbd>
                  ))}
                </p>
                <p className="shortcuts-meta-line">
                  <span>{presetLabel(rule.when)}</span>
                  <span
                    className={
                      isCustomized
                        ? 'shortcuts-source-badge shortcuts-source-user'
                        : 'shortcuts-source-badge'
                    }
                  >
                    {isCustomized ? 'User' : 'System'}
                  </span>
                </p>
                {selectedPresetId === null && rule.when ? (
                  <p className="shortcuts-default">When: {rule.when}</p>
                ) : null}
                {errorMessage ? <p className="shortcuts-command-error">{errorMessage}</p> : null}
              </div>

              <div className="shortcuts-keybinding-cell">
                {isEditing ? (
                  <button
                    type="button"
                    className="app-no-drag shortcuts-capture-button"
                    data-shortcut-capture="true"
                    autoFocus
                    onKeyDown={(event) => {
                      void handleCaptureKeyDown(event, definition.id)
                    }}
                    onBlur={handleCancelCapture}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Press a new shortcut...'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="app-no-drag shortcuts-keybinding-button"
                    onClick={() => handleStartCapture(definition.id)}
                    disabled={isLoading || isAnyPending}
                  >
                    {bindingDisplayTokens.length > 0 ? (
                      bindingDisplayTokens.map((token, index) => (
                        <kbd
                          key={`${definition.id}-${token}-${index}`}
                          className="shortcuts-keycap"
                        >
                          {token}
                        </kbd>
                      ))
                    ) : (
                      <span className="shortcuts-empty-binding">Not set</span>
                    )}
                  </button>
                )}

                <select
                  className="settings-pill-button app-no-drag"
                  value={selectedPresetId ?? ''}
                  onChange={(event) => {
                    const nextPresetId = event.target.value as ShortcutWhenPresetId
                    if (!nextPresetId) return
                    void handleWhenPresetChange(definition.id, nextPresetId)
                  }}
                  disabled={isLoading || isAnyPending || definition.whenPresets.length === 0}
                >
                  {selectedPresetId === null ? <option value="">Custom expression</option> : null}
                  {definition.whenPresets.map((presetId) => (
                    <option key={`${definition.id}-${presetId}`} value={presetId}>
                      {SHORTCUT_WHEN_PRESETS_BY_ID[presetId].label}
                    </option>
                  ))}
                </select>

                {definition.allowedScopes.length > 1 ? (
                  <select
                    className="settings-pill-button app-no-drag"
                    value={rule.scope}
                    onChange={(event) => {
                      void handleScopeChange(
                        definition.id,
                        event.target.value as 'window' | 'global'
                      )
                    }}
                    disabled={isLoading || isAnyPending}
                  >
                    {definition.allowedScopes.map((scope) => (
                      <option key={`${definition.id}-${scope}`} value={scope}>
                        {scopeLabel(scope)}
                      </option>
                    ))}
                  </select>
                ) : null}

                <button
                  type="button"
                  className="app-no-drag shortcuts-reset-row"
                  onClick={() => {
                    void handleResetShortcut(definition.id)
                  }}
                  disabled={isLoading || isAnyPending}
                >
                  Reset
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {isAdvancedOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          role="dialog"
        >
          <div className="flex max-h-[85vh] w-full max-w-[56rem] flex-col gap-3 rounded-[0.9rem] border border-border bg-background p-4 shadow-2xl">
            <div>
              <h3 className="text-[1rem] font-semibold text-foreground">Advanced JSON</h3>
              <p className="text-[0.8rem] text-muted-foreground">
                Edit shortcut rules as JSON with fields: command, key, when, scope.
              </p>
            </div>

            <textarea
              value={advancedValue}
              onChange={(event) => setAdvancedValue(event.target.value)}
              className="min-h-[22rem] w-full flex-1 rounded-[0.7rem] border border-border bg-[color-mix(in_oklch,var(--background)_92%,black_8%)] p-3 font-mono text-[0.79rem] text-foreground outline-none focus-visible:border-ring"
              spellCheck={false}
            />

            {advancedError ? (
              <p className="text-[0.78rem] text-destructive">{advancedError}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdvancedOpen(false)}
                disabled={pendingActionId !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleApplyAdvanced()}
                disabled={pendingActionId !== null}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export { ShortcutsSettingsPanel }
export type { ShortcutsSettingsPanelProps }
