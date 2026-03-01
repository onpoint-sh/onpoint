import { describe, expect, it } from 'vitest'
import {
  compileShortcutWhenExpression,
  validateShortcutWhenExpression
} from '@onpoint/shared/shortcut-when'

describe('compileShortcutWhenExpression', () => {
  it('evaluates logical and comparison expressions', () => {
    const expression = compileShortcutWhenExpression(
      "windowFocus && !shortcutCapture && activeEditor == 'code'"
    )

    expect(
      expression.evaluate({
        windowFocus: true,
        shortcutCapture: false,
        activeEditor: 'code'
      })
    ).toBe(true)

    expect(
      expression.evaluate({
        windowFocus: true,
        shortcutCapture: true,
        activeEditor: 'code'
      })
    ).toBe(false)
  })

  it('supports parentheses and inequality', () => {
    const expression = compileShortcutWhenExpression(
      "windowFocus && (activeEditor != 'markdown' || editorTextFocus)"
    )

    expect(
      expression.evaluate({
        windowFocus: true,
        activeEditor: 'markdown',
        editorTextFocus: true
      })
    ).toBe(true)

    expect(
      expression.evaluate({
        windowFocus: true,
        activeEditor: 'markdown',
        editorTextFocus: false
      })
    ).toBe(false)
  })

  it('validates syntax errors', () => {
    const result = validateShortcutWhenExpression('windowFocus &&')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason.length).toBeGreaterThan(0)
  })
})
