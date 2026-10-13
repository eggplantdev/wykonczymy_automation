import { describe, expect, it } from 'vitest'
import { subsetFieldErrors } from '@/components/forms/expense-form/subset-field-errors'

const issue = (path: (string | number)[], message: string) =>
  ({ code: 'custom', path, message }) as never

describe('subsetFieldErrors', () => {
  it("moves a row's error to that row's place in the form", () => {
    const formIndexOf = (subsetIndex: number) => [4, 7][subsetIndex]
    expect(
      subsetFieldErrors(
        [
          issue(['lineItems', 1, 'amount'], 'Podaj kwotę'),
          issue(['sourceRegister'], 'Wybierz kasę'),
        ],
        formIndexOf,
      ),
    ).toEqual([
      ['lineItems[7].amount', 'Podaj kwotę'],
      ['sourceRegister', 'Wybierz kasę'],
    ])
  })

  it('names no field for an issue on the list itself', () => {
    expect(subsetFieldErrors([issue(['lineItems'], 'Dodaj pozycję')], (i) => i)).toEqual([])
  })
})
