import { describe, it, expect } from 'vitest'
import { resolveExpenseCategoryId } from '@/components/forms/form-fields/resolve-expense-category-id'
import type { ExpenseCategoryRefT } from '@/types/reference-data'

const categories: ExpenseCategoryRefT[] = [
  { id: 3, name: 'Materiały' },
  { id: 7, name: 'Robocizna' },
]

describe('resolveExpenseCategoryId', () => {
  it('returns the id-as-string on an exact name match', () => {
    expect(resolveExpenseCategoryId('Materiały', categories)).toBe('3')
  })

  it('normalizes case and surrounding whitespace before matching', () => {
    expect(resolveExpenseCategoryId('  robocizna ', categories)).toBe('7')
  })

  it('returns "" for an unknown (hallucinated) category name', () => {
    expect(resolveExpenseCategoryId('Transport', categories)).toBe('')
  })

  it('returns "" for an empty name', () => {
    expect(resolveExpenseCategoryId('', categories)).toBe('')
    expect(resolveExpenseCategoryId('   ', categories)).toBe('')
  })
})
