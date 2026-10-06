import { describe, it, expect } from 'vitest'
import { parseWorkerReportSort, validWorkerReportSort } from '@/lib/queries/worker-report-sort'

describe('parseWorkerReportSort', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(parseWorkerReportSort({ sort: 'sentAt' })).toBe('sentAt')
    expect(parseWorkerReportSort({ sort: '-status' })).toBe('-status')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-acceptedLineCount' }],
    ['array value', { sort: ['sentAt', 'status'] }],
    ['bare minus', { sort: '-' }],
  ])('keeps the queue order for %s', (_label, searchParams) => {
    expect(parseWorkerReportSort(searchParams)).toBeUndefined()
  })
})

describe('validWorkerReportSort', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(validWorkerReportSort('-investmentName')).toBe('-investmentName')
  })

  it.each(['id', '-', '', undefined])('refuses %p', (param) => {
    expect(validWorkerReportSort(param)).toBeUndefined()
  })
})
