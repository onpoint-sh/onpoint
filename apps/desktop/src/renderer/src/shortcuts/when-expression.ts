import {
  compileShortcutWhenExpression,
  type CompiledShortcutWhenExpression,
  type ShortcutContextMap
} from '@onpoint/shared/shortcut-when'

const expressionCache = new Map<string, CompiledShortcutWhenExpression>()

function getCompiledExpression(when: string): CompiledShortcutWhenExpression | null {
  const normalizedWhen = when.trim()
  if (!normalizedWhen) return null

  const cachedExpression = expressionCache.get(normalizedWhen)
  if (cachedExpression) {
    return cachedExpression
  }

  const compiledExpression = compileShortcutWhenExpression(normalizedWhen)
  expressionCache.set(normalizedWhen, compiledExpression)
  return compiledExpression
}

export function evaluateWhenExpression(
  when: string | undefined,
  context: ShortcutContextMap
): boolean {
  if (!when) return true

  const compiledExpression = getCompiledExpression(when)
  if (!compiledExpression) return true

  try {
    return compiledExpression.evaluate(context)
  } catch {
    return false
  }
}
