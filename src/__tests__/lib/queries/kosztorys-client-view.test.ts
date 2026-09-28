import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { findClientViewRow, getClientViewSettings } from '@/lib/queries/kosztorys-client-view'
import { sanitizeClientViewSettings } from '@/lib/kosztorys/client-view-settings'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The resolution chain decides what a client is served, so it runs against the REAL DB: a `where`
// clause that matched everything, or a global read that swallowed its own absence, would pass any
// stub while serving one investment's settings to another.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const CODE_DEFAULTS = sanitizeClientViewSettings({})

// The row carries an order so the resolver's roundtrip covers it: a stored rank that came back
// empty would silently serve every investment in the built-in order.
const ROW_SETTINGS = {
  hiddenColumns: ['discountValue'],
  hideEmptyRows: false,
  columnRanks: { net: -1 },
}
const GLOBAL_SETTINGS = { hiddenColumns: ['plannedGross'], hideEmptyRows: true, columnRanks: {} }

describe.skipIf(!ENV_READY)('getClientViewSettings (DB)', () => {
  let payload: Payload
  let investmentWithRow: number
  let investmentWithoutRow: number

  const resetGlobal = () =>
    payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { hiddenColumns: null, hideEmptyRows: true, columnRanks: null },
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentWithRow = await createTestInvestment(payload, 'EX-695 client view spec (row)')
    investmentWithoutRow = await createTestInvestment(payload, 'EX-695 client view spec (fallback)')
    // The row is a fixture, not the first test's side effect — the specs below share one DB and
    // must not depend on each other's order to find it.
    await payload.create({
      collection: 'kosztorys-client-view',
      data: { investment: investmentWithRow, ...ROW_SETTINGS },
    })
  })

  afterAll(async () => {
    if (investmentWithRow) await deleteTestInvestment(payload, investmentWithRow)
    if (investmentWithoutRow) await deleteTestInvestment(payload, investmentWithoutRow)
    // The global is firm-wide state, not this spec's own row: left mutated, it would decide what a
    // later spec's investment serves.
    await resetGlobal()
  })

  // The save action calls this with no session on the payload client — its own gate already ran, and
  // the collection's access control answers „no user, no row". A lookup that quietly evaluates that
  // access instead of bypassing it fails the save with a generic „Nie możesz wykonać tej akcji".
  it('finds the row without a session', async () => {
    const row = await findClientViewRow(payload, investmentWithRow)
    expect(row).not.toBeNull()
  })

  it("serves the investment's own row over the firm-wide default", async () => {
    await payload.updateGlobal({ slug: 'kosztorys-client-view-defaults', data: GLOBAL_SETTINGS })

    expect(await getClientViewSettings(investmentWithRow)).toEqual(ROW_SETTINGS)
  })

  it('drops a stored key outside the allowlist — the ceiling is not a stored decision', async () => {
    await payload.update({
      collection: 'kosztorys-client-view',
      where: { investment: { equals: investmentWithRow } },
      data: { hiddenColumns: ['plannedGross', 'note', 'priceMode'] },
    })

    const settings = await getClientViewSettings(investmentWithRow)
    expect(settings.hiddenColumns).toEqual(['plannedGross'])
  })

  // A row wins as a whole. The migration leaves NULL on a row whose served variant was never
  // chosen; reading that as „fall through to the global" would change what such a client sees the
  // day the owner edits the firm-wide default.
  it('resolves a row with no hidden set to the code default, not to the global', async () => {
    await payload.updateGlobal({ slug: 'kosztorys-client-view-defaults', data: GLOBAL_SETTINGS })
    await payload.update({
      collection: 'kosztorys-client-view',
      where: { investment: { equals: investmentWithRow } },
      data: { hiddenColumns: null, hideEmptyRows: true, columnRanks: null },
    })

    expect(await getClientViewSettings(investmentWithRow)).toEqual(CODE_DEFAULTS)
  })

  it('falls back to the firm-wide default for an investment with no row', async () => {
    await payload.updateGlobal({ slug: 'kosztorys-client-view-defaults', data: GLOBAL_SETTINGS })

    expect(await getClientViewSettings(investmentWithoutRow)).toEqual(GLOBAL_SETTINGS)
  })

  it('falls back to the code default when the global holds nothing', async () => {
    await resetGlobal()

    expect(await getClientViewSettings(investmentWithoutRow)).toEqual(CODE_DEFAULTS)
  })
})
