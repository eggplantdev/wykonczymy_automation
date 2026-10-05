import { describe, it, expect } from 'vitest'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'
import { buildWorkerTransferWhere, workerTransferScope } from '@/lib/queries/worker-transfers'
import { isNoResultsSentinel } from '@/lib/db/where-to-sql'

// Risk #22: the scope is the worker page's whole access boundary — a URL filter may narrow it,
// never replace it.

const SCOPE = workerTransferScope(25, [37, 41])

const whereFor = (searchParams: Record<string, string>) =>
  buildWorkerTransferWhere(buildTransferFilters(searchParams, { id: 1 }), SCOPE)

describe('workerTransferScope', () => {
  it('matches his wypłaty and both sides of his kasy', () => {
    expect(SCOPE).toEqual({
      or: [
        { worker: { equals: 25 } },
        { sourceRegister: { in: [37, 41] } },
        { targetRegister: { in: [37, 41] } },
      ],
    })
  })

  it('leaves the kasa branches out for a worker without kasy', () => {
    expect(workerTransferScope(25, [])).toEqual({ or: [{ worker: { equals: 25 } }] })
  })
})

describe('buildWorkerTransferWhere — URL filters only narrow', () => {
  it('keeps the scope under and with no filter at all', () => {
    expect(whereFor({}).and).toEqual([SCOPE])
  })

  it('keeps the scope when ?sourceRegister= names a foreign kasa', () => {
    const where = whereFor({ sourceRegister: '99' })

    expect(where.and).toEqual([SCOPE])
    expect(where.or).toEqual([{ sourceRegister: { in: [99] } }, { targetRegister: { in: [99] } }])
  })

  it('keeps the scope when ?worker= names another worker', () => {
    const where = whereFor({ worker: '7' })

    expect(where.and).toEqual([SCOPE])
    expect(where.worker).toEqual({ in: [7] })
  })

  it('keeps the scope beside an investment filter', () => {
    const where = whereFor({ investment: '31' })

    expect(where.and).toEqual([SCOPE])
    expect(where.investment).toEqual({ in: [31] })
  })

  // The readers of a transfer Where look only at the top level.
  it('leaves the URL filters at the top level', () => {
    expect(whereFor({}).cancelled).toEqual({ not_equals: true })
    expect(isNoResultsSentinel(whereFor({ investment: 'abc' }))).toBe(true)
  })
})
