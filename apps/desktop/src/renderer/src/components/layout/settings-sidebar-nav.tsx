import { ArrowLeft, Eye, Keyboard, Palette } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DEFAULT_SETTINGS_SECTION_ID,
  getSettingsSectionPath,
  parseSettingsSectionFromPath,
  type SettingsSectionId
} from '@/pages/settings-sections'

type SettingsNavItem = {
  id: SettingsSectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'keyboard-shortcuts', label: 'Keyboard shortcuts', icon: Keyboard },
  { id: 'ghost-mode', label: 'Ghost mode', icon: Eye }
]

function SettingsSidebarNav(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  const activeSectionId =
    parseSettingsSectionFromPath(location.pathname) ?? DEFAULT_SETTINGS_SECTION_ID

  const handleSelectSection = (sectionId: SettingsNavItem['id']): void => {
    navigate(getSettingsSectionPath(sectionId))
  }

  return (
    <nav
      className="app-no-drag flex min-h-0 flex-1 flex-col items-center gap-[0.4rem]"
      aria-label="Settings sections"
    >
      <button
        type="button"
        className="flex h-8 w-full items-center justify-start gap-[0.45rem] rounded-[calc(var(--radius)-2px)] border border-transparent bg-transparent px-[0.55rem] text-left text-[0.8rem] text-muted-foreground transition-[background-color,border-color,color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_80%,transparent)] hover:text-sidebar-foreground focus-visible:border-sidebar-ring focus-visible:outline-none"
        onClick={() => navigate('/')}
      >
        <ArrowLeft className="size-4" />
        <span>Back to app</span>
      </button>

      <ul className="m-0 flex min-h-0 w-full flex-1 list-none flex-col gap-[0.16rem] overflow-auto p-0">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <li key={item.id}>
              <button
                type="button"
                className={`flex h-[1.9rem] w-full items-center justify-start gap-2 rounded-[calc(var(--radius)-2px)] border border-transparent bg-transparent px-[0.55rem] text-left text-[0.8rem] font-[510] text-muted-foreground transition-[background-color,border-color,color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_80%,transparent)] hover:text-sidebar-foreground focus-visible:border-sidebar-ring focus-visible:outline-none ${
                  activeSectionId === item.id ? 'text-sidebar-foreground' : ''
                }`}
                aria-current={activeSectionId === item.id ? 'page' : undefined}
                onClick={() => {
                  handleSelectSection(item.id)
                }}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export { SettingsSidebarNav }
