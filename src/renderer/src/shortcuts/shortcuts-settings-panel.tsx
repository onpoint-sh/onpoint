import { LoaderCircle, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  acceleratorToSignature,
  keyboardEventToAccelerator
} from '../../../shared/shortcut-accelerator'
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutDefinition
} from '../../../shared/shortcuts'
import { Button } from '@/components/ui/button'
import { useShortcutSettingsStore } from './shortcut-settings-store'

type ShortcutsSettingsPanelProps = {
  bindings: ShortcutBindings
  isLoading: boolean
}

function scopeLabel(scope: 'window' | 'global'): string {
  return scope === 'global' ? 'Global' : 'Window'
}

function whenLabel(definition: ShortcutDefinition): string {
  if (definition.scope === 'global') return 'App running (system-wide)'
  return definition.allowInEditable ? 'Window focused (including text inputs)' : 'Window focused'
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

function ShortcutsSettingsPanel({
  bindings,
  isLoading
}: ShortcutsSettingsPanelProps): React.JSX.Element {
  const platform = window.windowControls.platform
  const [searchValue, setSearchValue] = useState('')
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
      const binding = bindings[definition.id]
      return (
        definition.label.toLowerCase().includes(normalizedQuery) ||
        definition.description.toLowerCase().includes(normalizedQuery) ||
        definition.scope.toLowerCase().includes(normalizedQuery) ||
        definition.defaultAccelerator.toLowerCase().includes(normalizedQuery) ||
        binding.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [bindings, definitions, searchValue])

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
      const result = await window.shortcuts.update(actionId, accelerator)

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

      {filteredDefinitions.length === 0 ? (
        <p className="shortcuts-no-results">No shortcuts match &quot;{searchValue}&quot;.</p>
      ) : null}

      <div className="shortcuts-vscode-list">
        {filteredDefinitions.map((definition) => {
          const isEditing = editingActionId === definition.id
          const isPending = pendingActionId === definition.id
          const isAnyPending = pendingActionId !== null
          const binding = bindings[definition.id]
          const defaultBinding = definition.defaultAccelerator
          const isCustomized = binding !== defaultBinding
          const errorMessage = errorByAction[definition.id]
          const bindingDisplayTokens = acceleratorToDisplayTokens(binding, platform)
          const defaultDisplayTokens = acceleratorToDisplayTokens(defaultBinding, platform)

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
                  <span className="shortcuts-scope-pill">{scopeLabel(definition.scope)}</span>
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
                  <span>{whenLabel(definition)}</span>
                  <span
                    className={
                      isCustomized
                        ? 'shortcuts-source-badge shortcuts-source-user'
                        : 'shortcuts-source-badge'
                    }
                  >
                    {isCustomized ? 'User' : 'Default'}
                  </span>
                </p>
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
    </section>
  )
}

export { ShortcutsSettingsPanel }
export type { ShortcutsSettingsPanelProps }
