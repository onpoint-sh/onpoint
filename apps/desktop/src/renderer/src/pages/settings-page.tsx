import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { type ShortcutBindings } from '@onpoint/shared/shortcuts'
import {
  DEFAULT_GHOST_MODE_CONFIG,
  GHOST_MODE_OPACITY_MIN,
  GHOST_MODE_OPACITY_MAX,
  GHOST_MODE_OPACITY_STEP
} from '@onpoint/shared/ghost-mode'
import { type SettingsSectionId } from '@/pages/settings-sections'
import { ShortcutsSettingsPanel } from '@/shortcuts/shortcuts-settings-panel'
import { useThemeStore } from '@/stores/theme-store'
import {
  LIGHT_THEMES,
  DARK_THEMES,
  type ThemeDefinition,
  type ThemeMode
} from '@onpoint/themes'

type SettingsPageProps = {
  section: SettingsSectionId
  bindings: ShortcutBindings
  isShortcutsLoading: boolean
}

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'auto', label: 'Auto', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
]

function ThemeSwatch({ theme, selected, onClick }: { theme: ThemeDefinition; selected: boolean; onClick: () => void }): React.JSX.Element {
  const colors = theme.colors
  const previewColors = [
    colors.background,
    colors.sidebar,
    colors.muted,
    colors.ring,
    colors.foreground
  ]

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 rounded-[0.55rem] border px-3 py-2.5 text-left text-[0.82rem] transition-[border-color] duration-100"
      style={{
        borderColor: selected
          ? 'var(--ring)'
          : 'var(--border)',
        background: 'transparent'
      }}
    >
      <span className="flex shrink-0 overflow-hidden rounded-full" style={{ height: '1.5rem', width: '3.75rem' }}>
        {previewColors.map((color, i) => (
          <span
            key={i}
            className="block h-full"
            style={{ background: color, width: `${100 / previewColors.length}%` }}
          />
        ))}
      </span>
      <span className="flex-1 font-[510]" style={{ color: 'color-mix(in oklch, var(--foreground) 95%, transparent)' }}>
        {theme.name}
      </span>
      {selected ? (
        <Check className="size-3.5 shrink-0" style={{ color: 'var(--ring)' }} />
      ) : null}
    </button>
  )
}

function SettingsPage({
  section,
  bindings,
  isShortcutsLoading
}: SettingsPageProps): React.JSX.Element {
  const [ghostOpacity, setGhostOpacity] = useState(DEFAULT_GHOST_MODE_CONFIG.opacity)

  const themeMode = useThemeStore((s) => s.mode)
  const lightThemeId = useThemeStore((s) => s.lightThemeId)
  const darkThemeId = useThemeStore((s) => s.darkThemeId)
  const setMode = useThemeStore((s) => s.setMode)
  const setLightTheme = useThemeStore((s) => s.setLightTheme)
  const setDarkTheme = useThemeStore((s) => s.setDarkTheme)

  useEffect(() => {
    if (section !== 'ghost-mode') return
    void window.ghostMode.getConfig().then((config) => {
      setGhostOpacity(config.opacity)
    })
  }, [section])

  const handleOpacityChange = (value: number): void => {
    setGhostOpacity(value)
    void window.ghostMode.setOpacity(value)
  }

  const isKeyboard = section === 'keyboard-shortcuts'
  const maxWidthClass = isKeyboard ? 'max-w-[62rem]' : 'max-w-[56rem]'

  const showLightPicker = themeMode === 'auto' || themeMode === 'light'
  const showDarkPicker = themeMode === 'auto' || themeMode === 'dark'

  return (
    <section
      className={`settings-page mx-auto w-full px-5 py-5 ${maxWidthClass} ${isKeyboard ? 'flex h-full flex-col' : 'grid content-start'}`}
    >
      {section === 'appearance' ? (
        <section className="settings-section scroll-mt-3">
          <h2 className="settings-section-title">Appearance</h2>
          <article className="settings-section-card">
            <div className="settings-row">
              <div className="settings-row-main">
                <p className="settings-row-title">Color mode</p>
                <p className="settings-row-description">
                  Choose whether to follow system preference or force light/dark.
                </p>
              </div>
              <div className="flex items-center gap-1">
                {MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = themeMode === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className="settings-pill-button flex items-center gap-1.5"
                      style={active ? {
                        borderColor: 'color-mix(in oklch, var(--ring) 55%, var(--border))',
                        background: 'color-mix(in oklch, var(--ring) 12%, var(--background))'
                      } : undefined}
                    >
                      <Icon className="size-3.5" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </article>

          {showLightPicker ? (
            <>
              <h3 className="mt-3 text-[0.95rem] font-[600]" style={{ color: 'color-mix(in oklch, var(--foreground) 90%, transparent)' }}>
                Light theme
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {LIGHT_THEMES.map((theme) => (
                  <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    selected={lightThemeId === theme.id}
                    onClick={() => setLightTheme(theme.id)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {showDarkPicker ? (
            <>
              <h3 className="mt-3 text-[0.95rem] font-[600]" style={{ color: 'color-mix(in oklch, var(--foreground) 90%, transparent)' }}>
                Dark theme
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {DARK_THEMES.map((theme) => (
                  <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    selected={darkThemeId === theme.id}
                    onClick={() => setDarkTheme(theme.id)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {section === 'keyboard-shortcuts' ? (
        <section className="settings-section scroll-mt-3 min-h-0 flex-1 flex flex-col">
          <h2 className="settings-section-title">Keyboard</h2>
          <ShortcutsSettingsPanel bindings={bindings} isLoading={isShortcutsLoading} />
        </section>
      ) : null}

      {section === 'ghost-mode' ? (
        <section className="settings-section scroll-mt-3">
          <h2 className="settings-section-title">Ghost mode</h2>
          <article className="settings-section-card">
            <div className="settings-row">
              <div className="settings-row-main">
                <p className="settings-row-title">Window opacity</p>
                <p className="settings-row-description">
                  How transparent the window appears when ghost mode is active.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={GHOST_MODE_OPACITY_MIN}
                  max={GHOST_MODE_OPACITY_MAX}
                  step={GHOST_MODE_OPACITY_STEP}
                  value={ghostOpacity}
                  onChange={(event) => handleOpacityChange(Number(event.target.value))}
                  className="h-1.5 w-28 cursor-pointer accent-foreground"
                />
                <span className="settings-value-chip w-14 text-center">
                  {Math.round(ghostOpacity * 100)}%
                </span>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  )
}

export { SettingsPage }
export type { SettingsPageProps }
