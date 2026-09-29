import { describe, expect, it } from 'vitest'
import {
  requiredFields,
  toColumnOptions,
} from '@/components/kosztorys/editor/dialogs/sheet/sheet-column-picker-options'
import type { CandidateColumnT } from '@/lib/kosztorys/sheet-import/resolve-columns'

const candidate = (column: number, letter: string, labels: string[] = []): CandidateColumnT => ({
  column,
  letter,
  labels,
})

describe('toColumnOptions', () => {
  it('names a column by its letter and every header text under it', () => {
    expect(toColumnOptions([candidate(18, 'S', ['wartość netto', 'przedmiar'])])).toEqual([
      { value: '18', label: 'S — wartość netto / przedmiar' },
    ])
  })

  it('drops a column with no header text anywhere in the block', () => {
    const options = toColumnOptions([candidate(30, 'AE'), candidate(18, 'S', ['rabat'])])

    expect(options.map((option) => option.label)).toEqual(['S — rabat'])
  })
})

describe('requiredFields', () => {
  it('offers a pick only for the fields whose absence refuses the read', () => {
    const fields = requiredFields({
      missingFields: [
        { field: 'netValue', required: true, reason: 'absent' },
        { field: 'comment', required: false, reason: 'absent' },
      ],
      candidates: [],
      pointedFields: [],
    })

    expect(fields).toEqual(['netValue'])
  })
})
