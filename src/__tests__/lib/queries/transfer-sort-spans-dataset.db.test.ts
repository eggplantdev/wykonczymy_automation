import { describe, it, expect, beforeAll } from 'vitest'
import { findTransfersRaw, type RawTransferDocT } from '@/lib/queries/transfers'

// The defect EX-777 names: sorting that only ever sees the rows already fetched, so „największe
// kwoty" means „największe na tej stronie". Nothing short of a real query over a set LARGER than
// one page can tell the two apart — a mocked find would return whatever the mock was handed.
// Read-only on purpose: it asserts against the restored dataset and creates nothing, so it cannot
// leave rows behind for the golden master. Runs via `pnpm test:integration` against 5435.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const PAGE_LIMIT = 20

describe.skipIf(!ENV_READY)('transfer sort spans the whole filtered set (DB)', () => {
  let everyDoc: RawTransferDocT[] = []
  let firstPage: RawTransferDocT[] = []

  beforeAll(async () => {
    // Fetched in a DIFFERENT order than the one under test: if the page were sorted client-side,
    // it would hold the top of this id-ordered prefix instead of the global maximum.
    const all = await findTransfersRaw({ page: 1, limit: 50000, sort: '-id' })
    everyDoc = all.docs
    const page = await findTransfersRaw({ page: 1, limit: PAGE_LIMIT, sort: '-amount' })
    firstPage = page.docs
    // 30s: the first getPayload cold-inits Payload's schema (see the other .db specs).
  }, 30000)

  it('has more rows than one page, or the assertions below prove nothing', () => {
    expect(everyDoc.length).toBeGreaterThan(PAGE_LIMIT)
  })

  it('puts the global maximum amount on the first page', () => {
    // Asserted before the index: an empty page would otherwise read as a TypeError on `undefined`
    // instead of „the test DB was never imported".
    expect(firstPage.length).toBeGreaterThan(0)
    const globalMax = Math.max(...everyDoc.map((doc) => Number(doc.amount)))
    expect(Number(firstPage[0].amount)).toBe(globalMax)
  })

  it('fills the first page with the globally largest amounts', () => {
    // Compared as amounts, not ids: rows tied on amount may come back in either order, and the
    // claim under test is about the ORDER OF VALUES, not which of two equal rows won the tie.
    const globalTop = everyDoc
      .map((doc) => Number(doc.amount))
      .sort((left, right) => right - left)
      .slice(0, PAGE_LIMIT)
    expect(firstPage.map((doc) => Number(doc.amount))).toEqual(globalTop)
  })
})
