function isEditableInput(element: HTMLInputElement): boolean {
  const nonTextInputTypes = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit'
  ])

  return !nonTextInputTypes.has(element.type.toLowerCase())
}

export function isShortcutCaptureTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false

  return Boolean(target.closest('[data-shortcut-capture="true"]'))
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false

  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable || target.getAttribute('role') === 'textbox') {
    return true
  }

  const editableAncestor = target.closest('textarea, [contenteditable], [role="textbox"], input')

  if (!editableAncestor) return false

  if (editableAncestor instanceof HTMLInputElement) {
    return isEditableInput(editableAncestor)
  }

  return true
}
