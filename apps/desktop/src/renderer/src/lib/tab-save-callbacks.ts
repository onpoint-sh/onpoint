/**
 * Module-level registry for tab save callbacks.
 * PaneEditor registers a save callback for each mounted tab.
 * The tab bar calls these when the user confirms "Save" on a dirty-close dialog.
 *
 * The callback returns `true` if the save succeeded (tab can be closed),
 * or `false` if the user cancelled (e.g. cancelled a Save As dialog).
 */
export const tabSaveCallbacks = new Map<string, () => Promise<boolean>>()
