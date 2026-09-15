import { describe, it, expect } from 'vitest'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'

describe('sortParamToSortingState', () => {
  it('reads direction off the leading minus', () => {
    expect(sortParamToSortingState('amount')).toEqual([{ id: 'amount', desc: false }])
    expect(sortParamToSortingState('-amount')).toEqual([{ id: 'amount', desc: true }])
  })

  it.each([undefined, '', '-'])('yields no sorting for %o', (param) => {
    expect(sortParamToSortingState(param)).toEqual([])
  })
})

describe('sortingStateToParam', () => {
  it('writes the Payload format', () => {
    expect(sortingStateToParam([{ id: 'date', desc: true }])).toBe('-date')
    expect(sortingStateToParam([{ id: 'date', desc: false }])).toBe('date')
  })

  // An empty string is what removes the parameter from the URL — writing the default value instead
  // would pin „no sorting" to a sort nobody asked for, and the third header click would be a no-op.
  it('maps the empty state to an empty string', () => {
    expect(sortingStateToParam([])).toBe('')
  })
})
