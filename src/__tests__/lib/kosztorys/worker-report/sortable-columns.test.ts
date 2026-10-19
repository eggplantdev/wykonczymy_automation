import { describe, it, expect } from 'vitest'
import { workerReportSort } from '@/lib/kosztorys/worker-report/sortable-columns'

describe('workerReportSort.parse', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(workerReportSort.parse({ sort: 'sentAt' })).toBe('sentAt')
    expect(workerReportSort.parse({ sort: '-status' })).toBe('-status')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-acceptedLineCount' }],
    ['array value', { sort: ['sentAt', 'status'] }],
    ['bare minus', { sort: '-' }],
  ])('keeps the queue order for %s', (_label, searchParams) => {
    expect(workerReportSort.parse(searchParams)).toBeUndefined()
  })
})

describe('workerReportSort.valid', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(workerReportSort.valid('-investmentName')).toBe('-investmentName')
  })

  it.each(['id', '-', '', undefined])('refuses %p', (param) => {
    expect(workerReportSort.valid(param)).toBeUndefined()
  })
})
