export type ShortcutContextValue = boolean | string | number | undefined
export type ShortcutContextMap = Record<string, ShortcutContextValue>

type TokenType =
  | 'identifier'
  | 'string'
  | 'number'
  | 'boolean'
  | 'and'
  | 'or'
  | 'not'
  | 'eq'
  | 'neq'
  | 'lparen'
  | 'rparen'
  | 'eof'

type Token = {
  type: TokenType
  value?: string | number | boolean
  index: number
}

type ExpressionNode =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'not'; operand: ExpressionNode }
  | {
      kind: 'binary'
      operator: 'and' | 'or' | 'eq' | 'neq'
      left: ExpressionNode
      right: ExpressionNode
    }

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char)
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_.]/.test(char)
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (char === '&' && source[index + 1] === '&') {
      tokens.push({ type: 'and', index })
      index += 2
      continue
    }

    if (char === '|' && source[index + 1] === '|') {
      tokens.push({ type: 'or', index })
      index += 2
      continue
    }

    if (char === '!' && source[index + 1] === '=') {
      tokens.push({ type: 'neq', index })
      index += 2
      continue
    }

    if (char === '=') {
      if (source[index + 1] === '=') {
        tokens.push({ type: 'eq', index })
        index += 2
        continue
      }

      throw new Error(`Unexpected token "=" at position ${index}. Use "==" for equality.`)
    }

    if (char === '!') {
      tokens.push({ type: 'not', index })
      index += 1
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', index })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'rparen', index })
      index += 1
      continue
    }

    if (char === "'") {
      let cursor = index + 1
      let value = ''

      while (cursor < source.length) {
        const nextChar = source[cursor]
        if (nextChar === '\\') {
          const escaped = source[cursor + 1]
          if (escaped === undefined) {
            throw new Error(`Unterminated string literal at position ${index}.`)
          }
          value += escaped
          cursor += 2
          continue
        }

        if (nextChar === "'") {
          tokens.push({ type: 'string', value, index })
          index = cursor + 1
          value = ''
          break
        }

        value += nextChar
        cursor += 1
      }

      if (cursor >= source.length && source[cursor - 1] !== "'") {
        throw new Error(`Unterminated string literal at position ${index}.`)
      }

      continue
    }

    if (/[0-9]/.test(char)) {
      const start = index
      let cursor = index + 1
      while (cursor < source.length && /[0-9.]/.test(source[cursor])) {
        cursor += 1
      }

      const raw = source.slice(start, cursor)
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number literal "${raw}" at position ${start}.`)
      }

      tokens.push({ type: 'number', value: parsed, index: start })
      index = cursor
      continue
    }

    if (isIdentifierStart(char)) {
      const start = index
      let cursor = index + 1
      while (cursor < source.length && isIdentifierPart(source[cursor])) {
        cursor += 1
      }

      const raw = source.slice(start, cursor)
      if (raw === 'true' || raw === 'false') {
        tokens.push({ type: 'boolean', value: raw === 'true', index: start })
      } else {
        tokens.push({ type: 'identifier', value: raw, index: start })
      }
      index = cursor
      continue
    }

    throw new Error(`Unexpected token "${char}" at position ${index}.`)
  }

  tokens.push({ type: 'eof', index: source.length })
  return tokens
}

class Parser {
  private readonly tokens: Token[]
  private cursor = 0

  constructor(source: string) {
    this.tokens = tokenize(source)
  }

  parse(): ExpressionNode {
    const node = this.parseOr()
    this.expect('eof')
    return node
  }

  private parseOr(): ExpressionNode {
    let node = this.parseAnd()

    while (this.match('or')) {
      node = {
        kind: 'binary',
        operator: 'or',
        left: node,
        right: this.parseAnd()
      }
    }

    return node
  }

  private parseAnd(): ExpressionNode {
    let node = this.parseComparison()

    while (this.match('and')) {
      node = {
        kind: 'binary',
        operator: 'and',
        left: node,
        right: this.parseComparison()
      }
    }

    return node
  }

  private parseComparison(): ExpressionNode {
    let node = this.parseUnary()

    while (true) {
      if (this.match('eq')) {
        node = {
          kind: 'binary',
          operator: 'eq',
          left: node,
          right: this.parseUnary()
        }
        continue
      }

      if (this.match('neq')) {
        node = {
          kind: 'binary',
          operator: 'neq',
          left: node,
          right: this.parseUnary()
        }
        continue
      }

      break
    }

    return node
  }

  private parseUnary(): ExpressionNode {
    if (this.match('not')) {
      return {
        kind: 'not',
        operand: this.parseUnary()
      }
    }

    return this.parsePrimary()
  }

  private parsePrimary(): ExpressionNode {
    if (this.match('lparen')) {
      const node = this.parseOr()
      this.expect('rparen')
      return node
    }

    const token = this.peek()
    if (token.type === 'identifier') {
      this.cursor += 1
      return { kind: 'identifier', name: String(token.value) }
    }

    if (token.type === 'string' || token.type === 'number' || token.type === 'boolean') {
      this.cursor += 1
      return { kind: 'literal', value: token.value as string | number | boolean }
    }

    throw new Error(`Unexpected token "${token.type}" at position ${token.index}.`)
  }

  private match(type: TokenType): boolean {
    if (this.peek().type !== type) return false
    this.cursor += 1
    return true
  }

  private expect(type: TokenType): Token {
    const token = this.peek()

    if (token.type !== type) {
      throw new Error(`Expected ${type} at position ${token.index}, found ${token.type}.`)
    }

    this.cursor += 1
    return token
  }

  private peek(): Token {
    return this.tokens[this.cursor]
  }
}

function toBool(value: unknown): boolean {
  return Boolean(value)
}

function evaluateNode(node: ExpressionNode, context: ShortcutContextMap): ShortcutContextValue {
  if (node.kind === 'literal') {
    return node.value
  }

  if (node.kind === 'identifier') {
    return context[node.name]
  }

  if (node.kind === 'not') {
    return !toBool(evaluateNode(node.operand, context))
  }

  if (node.operator === 'and') {
    const leftValue = evaluateNode(node.left, context)
    if (!toBool(leftValue)) return false
    return toBool(evaluateNode(node.right, context))
  }

  if (node.operator === 'or') {
    const leftValue = evaluateNode(node.left, context)
    if (toBool(leftValue)) return true
    return toBool(evaluateNode(node.right, context))
  }

  const leftValue = evaluateNode(node.left, context)
  const rightValue = evaluateNode(node.right, context)

  if (node.operator === 'eq') {
    return leftValue === rightValue
  }

  return leftValue !== rightValue
}

export type CompiledShortcutWhenExpression = {
  expression: string
  evaluate: (context: ShortcutContextMap) => boolean
}

export function compileShortcutWhenExpression(expression: string): CompiledShortcutWhenExpression {
  const normalizedExpression = expression.trim()

  if (normalizedExpression.length === 0) {
    throw new Error('When expression cannot be empty.')
  }

  const parser = new Parser(normalizedExpression)
  const ast = parser.parse()

  return {
    expression: normalizedExpression,
    evaluate: (context) => toBool(evaluateNode(ast, context))
  }
}

export function validateShortcutWhenExpression(
  expression: string
): { ok: true } | { ok: false; reason: string } {
  try {
    compileShortcutWhenExpression(expression)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: (error as Error).message
    }
  }
}
