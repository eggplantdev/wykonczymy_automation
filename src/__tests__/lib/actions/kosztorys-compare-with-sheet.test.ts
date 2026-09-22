import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'
import { row } from '@/__tests__/fixtures/kosztorys-sheet/grid'

// „Porównaj z arkuszem" writes one column on rows it did not create, so the only assertion worth
// making is against the PERSISTED value — the action's own counters would report a write that never
// landed.
//
// The sheet is mocked at the reader; resolve → parse → match below it is the real code.
const authState = vi.hoisted(() => ({ userId: 0 }))
const sheetState = vi.hoisted(() => ({
  spreadsheetId: 'sheet-under-test' as string | undefined,
  formulas: [] as (string | number)[][],
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
vi.mock('@/lib/google/sheet-lookup', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getInvestmentSheet: vi
    .fn()
    .mockImplementation(async () =>
      sheetState.spreadsheetId === undefined
        ? undefined
        : { id: 1, googleSheetId: sheetState.spreadsheetId, sheetColumnMapping: {} },
    ),
}))
vi.mock('@/lib/google/readonly-sheets-client', () => ({
  getReadonlySheetsClient: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/kosztorys/sheet-import/read-sheet', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readImportGrids: vi.fn().mockImplementation(async () => ({
    laborGrid: BIALOSTOCKA_ROWS,
    laborGridFormulas: sheetState.formulas,
    laborTabGid: 70964819,
    rateTabs: [
      ratesTab('zakres pracy z narzędziami', [
        { description: 'montaż jednostki wewnętrznej', wTools: 78, ownTools: 60 },
      ]),
    ],
  })),
}))

const { applyKosztorysImport, compareWithSheet } = await import('@/lib/actions/kosztorys-import')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// Białostocka's first praca sits at grid index 4 (sheet row 5); its Pomiar reading as a formula is
// exactly the „przepisany z Przedmiaru" case the refresh must translate into „no measurement".
const FIRST_ITEM_ROW = 4

describe.skipIf(!ENV_READY)('compareWithSheet — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the snapshot to')
    authState.userId = Number(firstUser.id)
    investmentId = await createTestInvestment(payload, 'kosztorys-refresh-measured-qty-test')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  async function measuredQtyByDescription(): Promise<Record<string, number | null>> {
    const res = await db.execute(sql`
      SELECT description, sheet_measured_qty FROM kosztorys_items WHERE investment_id = ${investmentId}
    `)
    return Object.fromEntries(
      res.rows.map((r) => [
        String(r.description),
        r.sheet_measured_qty === null ? null : Number(r.sheet_measured_qty),
      ]),
    )
  }

  // One tree built by the import (so every praca matches the sheet by name) plus one praca the sheet
  // has never heard of, in a section of its own.
  async function seedTree(): Promise<void> {
    sheetState.formulas = []
    await applyKosztorysImport(investmentId)

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Poza arkuszem', displayOrder: 99 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: section.id,
        displayOrder: 0,
        description: 'praca wpisana ręcznie',
        plannedQty: 3,
        sheetMeasuredQty: 7,
        clientPrice: 100,
        discountValue: 0,
      },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })

    // Every stored figure deliberately wrong, so a green assertion can only come from a real write.
    await db.execute(sql`
      UPDATE kosztorys_items SET sheet_measured_qty = 999 WHERE investment_id = ${investmentId}
    `)
  }

  it('writes the sheet’s Pomiar onto matched prace and clears the ones it stopped claiming', async () => {
    await seedTree()
    // The first praca's Pomiar sums the etapy — no claim, so its stored figure is cleared. The
    // second mirrors the Przedmiar, which is still a claim and lands as the reference figure.
    sheetState.formulas = BIALOSTOCKA_ROWS.map((_, index) =>
      index === FIRST_ITEM_ROW
        ? row({ O: '=SUM(D5:M5)' })
        : index === FIRST_ITEM_ROW + 1
          ? row({ O: '=N6' })
          : [],
    )

    const result = await compareWithSheet(investmentId)

    expect(result).toMatchObject({
      success: true,
      data: { refresh: { updated: 2, cleared: 1, unmatched: 1 } },
    })
    expect(await measuredQtyByDescription()).toMatchObject({
      'zakup, transport i wniesienie towaru budowlanego': null,
      'montaż płyt akustycznych dodatek': 50,
      'montaż jednostki wewnętrznej': 2,
    })
  })

  it('leaves a praca the sheet does not name untouched', async () => {
    expect((await measuredQtyByDescription())['praca wpisana ręcznie']).toBe(999)
  })

  it('writes nothing on a second read of the same sheet, and still reports the comparison', async () => {
    // The window opens on every glance, so a re-read that rewrote every row would make „zaciągnięto"
    // meaningless — the counters have to say „już zgodne".
    const result = await compareWithSheet(investmentId)

    expect(result).toMatchObject({
      success: true,
      data: { refresh: { updated: 0, cleared: 0, unmatched: 1 } },
    })
    expect(result.success && result.data.comparison?.counts.matched).toBe(3)
  })

  // The editor reseeds its grid off the investment's revision token, so a write that moves rows
  // without moving that token leaves the owner reading pre-write figures — and leaves the reseed
  // armed to fire on whatever unrelated edit comes next, taking their search and sort with it.
  async function revisionToken(): Promise<string> {
    const res = await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${investmentId}`)
    return String(res.rows[0]?.updated_at)
  }

  it('leaves the revision token alone when the stored figures were already current', async () => {
    const before = await revisionToken()
    await compareWithSheet(investmentId)

    expect(await revisionToken()).toBe(before)
  })

  it('moves the revision token when it actually writes', async () => {
    await db.execute(sql`
      UPDATE kosztorys_items SET sheet_measured_qty = 42
      WHERE investment_id = ${investmentId} AND description = 'montaż jednostki wewnętrznej'
    `)
    const before = await revisionToken()

    const result = await compareWithSheet(investmentId)

    expect(result).toMatchObject({ success: true, data: { refresh: { updated: 1, cleared: 0 } } })
    expect(await revisionToken()).not.toBe(before)
  })

  it('reports a missing sheet link in Polish instead of clearing every measurement', async () => {
    sheetState.spreadsheetId = undefined
    try {
      expect(await compareWithSheet(investmentId)).toMatchObject({
        success: false,
        error: 'Inwestycja nie ma kosztorysu.',
      })
      expect((await measuredQtyByDescription())['montaż jednostki wewnętrznej']).toBe(2)
    } finally {
      sheetState.spreadsheetId = 'sheet-under-test'
    }
  })
})
