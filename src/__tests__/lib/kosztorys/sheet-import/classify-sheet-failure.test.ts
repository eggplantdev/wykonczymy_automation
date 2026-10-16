import { describe, expect, it } from 'vitest'
import { classifySheetFailure } from '@/lib/kosztorys/sheet-import/classify-sheet-failure'
import { MissingLaborTabError } from '@/lib/kosztorys/sheet-import/read-sheet'

describe('classifySheetFailure', () => {
  it('reads a refused sheet as a sharing problem', () => {
    expect(classifySheetFailure({ status: 403 })).toBe('forbidden')
  })

  it('reads a dead spreadsheet id as a wrong sheet', () => {
    expect(classifySheetFailure({ status: 404 })).toBe('not-found')
  })

  it('reads a missing robocizna tab off the error the reader throws itself', () => {
    expect(classifySheetFailure(new MissingLaborTabError('abc'))).toBe('missing-tab')
  })

  it('falls back to an outage for anything else', () => {
    expect(classifySheetFailure(new Error('socket hang up'))).toBe('unknown')
    expect(classifySheetFailure({ status: 500 })).toBe('unknown')
    expect(classifySheetFailure(undefined)).toBe('unknown')
  })

  // googleapis reports the status in a different place depending on which layer threw. Reading only
  // one of them would silently downgrade most 403s to the catch-all.
  it.each([
    ['status', { status: 403 }],
    ['code as a number', { code: 403 }],
    ['code as a string', { code: '403' }],
    ['code as an enum', { code: 'PERMISSION_DENIED' }],
    ['response.status', { response: { status: 403 } }],
  ])('finds a refusal reported through %s', (_label, error) => {
    expect(classifySheetFailure(error)).toBe('forbidden')
  })
})
