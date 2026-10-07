// `+ − * /` and parentheses over decimal numbers — the arithmetic the owner types into a sheet cell
// („3,5x2,8", „=12+4"), and nothing more: no cell references, no functions. Hand-written rather than
// `eval`/`Function`, because the input is whatever lands in a grid cell, clipboard included.
//
// Expects whitespace already stripped. `x`/`×` multiply because that is how room dimensions are
// written. EVERY comma is a decimal separator, unlike `parseDecimalInput`'s single replace, since an
// expression holds several numbers. `null` for anything malformed or non-finite (division by zero).

const MULTIPLY = new Set(['*', 'x', 'X', '×'])
const NUMBER = /^(\d+([.,]\d*)?|[.,]\d+)/

export function evaluateArithmetic(expression: string): number | null {
  const source = expression.startsWith('=') ? expression.slice(1) : expression
  let position = 0

  const parseExpression = (): number | null => {
    let left = parseTerm()
    while (left !== null && (source[position] === '+' || source[position] === '-')) {
      const operator = source[position++]
      const right = parseTerm()
      if (right === null) return null
      left = operator === '+' ? left + right : left - right
    }
    return left
  }

  const parseTerm = (): number | null => {
    let left = parseFactor()
    while (left !== null && (MULTIPLY.has(source[position]) || source[position] === '/')) {
      const operator = source[position++]
      const right = parseFactor()
      if (right === null) return null
      left = operator === '/' ? left / right : left * right
    }
    return left
  }

  const parseFactor = (): number | null => {
    const char = source[position]
    if (char === '+' || char === '-') {
      position++
      const operand = parseFactor()
      return operand === null ? null : char === '-' ? -operand : operand
    }
    if (char === '(') {
      position++
      const inner = parseExpression()
      if (inner === null || source[position] !== ')') return null
      position++
      return inner
    }
    const match = NUMBER.exec(source.slice(position))
    if (!match) return null
    position += match[0].length
    return Number(match[0].replace(',', '.'))
  }

  const result = parseExpression()
  if (result === null || position !== source.length || !Number.isFinite(result)) return null
  return result
}
