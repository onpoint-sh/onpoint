export const SETTINGS_SECTION_IDS = ['appearance', 'keyboard-shortcuts', 'ghost-mode'] as const

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number]

export const DEFAULT_SETTINGS_SECTION_ID: SettingsSectionId = 'keyboard-shortcuts'

export function getSettingsSectionPath(sectionId: SettingsSectionId): string {
  return `/settings/${sectionId}`
}

export function parseSettingsSectionFromPath(pathname: string): SettingsSectionId | null {
  for (const sectionId of SETTINGS_SECTION_IDS) {
    if (pathname === getSettingsSectionPath(sectionId)) {
      return sectionId
    }
  }

  return null
}
