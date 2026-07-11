import { describe, it, expect } from 'vitest'
import type { PaginatedDocs } from 'payload'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'

// Minimal PaginatedDocs stub — only the fields the guard reads. This tests the guard's
// LOGIC (throw-when-truncated), not Payload's promise to set hasNextPage; validating that
// promise against a real capped query is the deferred DB-integration test.
const page = <T>(over: Partial<PaginatedDocs<T>>): PaginatedDocs<T> =>
  ({ docs: [], hasNextPage: false, totalDocs: 0, limit: 10, ...over }) as PaginatedDocs<T>

describe('assertCompletePage', () => {
  it('returns docs unchanged when the page is complete', () => {
    const docs = [{ id: 1 }, { id: 2 }]
    expect(assertCompletePage(page({ docs, hasNextPage: false }), 'ctx')).toBe(docs)
  })

  it('returns an empty array for an empty complete result', () => {
    expect(assertCompletePage(page({ docs: [], hasNextPage: false }), 'ctx')).toEqual([])
  })

  it('throws when the result is truncated (hasNextPage)', () => {
    expect(() =>
      assertCompletePage(page({ docs: [{ id: 1 }], hasNextPage: true }), 'ctx'),
    ).toThrow()
  })

  it('names the caller and the limit/total in the thrown message — the diagnostic is the point', () => {
    expect(() =>
      assertCompletePage(page({ hasNextPage: true, totalDocs: 9001, limit: 5000 }), 'getLeads'),
    ).toThrow(/getLeads.*9001.*5000/s)
  })
})
