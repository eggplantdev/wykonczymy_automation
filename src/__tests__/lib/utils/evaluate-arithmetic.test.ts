import { describe, expect, it } from 'vitest'
import { evaluateArithmetic } from '@/lib/utils/evaluate-arithmetic'

describe('evaluateArithmetic', () => {
  it.each([
    ['2+3*4', 14],
    ['(2+3)*4', 20],
    ['10-2-3', 5],
    ['12/2/3', 2],
    ['-3*2', -6],
    ['2*-3', -6],
    ['3,5x2,8', 9.8],
    ['3,5X2', 7],
    ['3,5×2', 7],
    ['=12+4', 16],
    ['1,5*2,5', 3.75],
    ['.5+,5', 1],
    ['7', 7],
  ])('%s → %s', (expression, expected) => {
    expect(evaluateArithmetic(expression)).toBeCloseTo(expected, 10)
  })

  it.each(['2*', '*2', '2**3', '(2+3', '2+3)', '=', '', '1/0', '2(3)', 'abc', '1e3*2', '==2'])(
    'odrzuca %j',
    (expression) => {
      expect(evaluateArithmetic(expression)).toBeNull()
    },
  )
})
