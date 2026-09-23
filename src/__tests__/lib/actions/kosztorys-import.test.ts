import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'

// The import replaces a whole kosztorys behind an automatic snapshot, so the only assertions worth
// making are against PERSISTED state — a success result would hide a failed write, and the
// „recoverable" guarantee is real only if the pre-import snapshot actually restores.
//
// The sheet itself is mocked at the reader: everything below it (resolve → parse → merge) is the
// real code, so this spec exercises the write path without hitting Google.
const authState = vi.hoisted(() => ({ userId: 0, role: 'OWNER' as string }))
const sheetState = vi.hoisted(() => ({ spreadsheetId: 'sheet-under-test' as string | undefined }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: authState.role },
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
    laborGridFormulas: [],
    rateTabs: [
      ratesTab('zakres pracy z narzędziami', [
        { description: 'montaż jednostki wewnętrznej', wTools: 78, ownTools: 60 },
      ]),
    ],
  })),
}))

const { applyKosztorysImport, previewKosztorysImport } =
  await import('@/lib/actions/kosztorys-import')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys import actions — persisted state (DB)', () => {
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
    investmentId = await createTestInvestment(payload, 'kosztorys-import-test')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((row) => String(row.name))
  }

  async function seedSection(name: string): Promise<void> {
    await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name, displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
  }

  it('writes the sheet’s sections and prace to the investment', async () => {
    const result = await applyKosztorysImport(investmentId)

    expect(result).toMatchObject({ success: true })
    expect(await sectionNames()).toEqual(['Prace dodatkowe', 'Klimatyzacja'])
  })

  // The bug this pins cost 151 stawki half a percent each and looked deliberate in the editor: the
  // import hands a praca running at the cennik's own markup to the global coefficient („auto"), but
  // `replaceTreeWithSnapshot` overwrote the plan's settings with the investment's live ones — so
  // those prace repriced at whatever the investment held (0,55) instead of the sheet's (0,5525).
  // Asserted on the persisted investment row, since the action's success result hid the whole thing.
  it('adopts the cennik’s markup as the investment’s multipliers, so „auto" prices at the sheet', async () => {
    await applyKosztorysImport(investmentId)

    const investment = await db.execute(sql`
      SELECT w_tools_coeff, own_tools_coeff FROM investments WHERE id = ${investmentId}
    `)
    // 78 / 120 and 60 / 120 in the mocked cennik above.
    expect(Number(investment.rows[0].w_tools_coeff)).toBeCloseTo(0.65, 6)
    expect(Number(investment.rows[0].own_tools_coeff)).toBeCloseTo(0.5, 6)

    const item = await db.execute(sql`
      SELECT w_tools_override_value, own_tools_override_value FROM kosztorys_items
      WHERE investment_id = ${investmentId} AND description = 'montaż jednostki wewnętrznej'
    `)
    expect(item.rows[0]).toMatchObject({
      w_tools_override_value: null,
      own_tools_override_value: null,
    })
  })

  // Found by LABEL, not by „newest auto": the whole point of the pre-import row being `manual` is
  // that it survives the auto count cap + 7-day GC and stays identifiable among the periodic
  // autosaves. Querying it the way the „Wersje" panel presents it is what pins that.
  it('takes a labelled pre-import snapshot that restores the tree the import replaced', async () => {
    await payload.delete({
      collection: 'kosztorys-sections',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await seedSection('Stan sprzed importu')

    await applyKosztorysImport(investmentId)
    expect(await sectionNames()).not.toContain('Stan sprzed importu')

    const snapshots = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId}
        AND kind = 'manual'
        AND label = 'Przed importem z arkusza Google'
      ORDER BY id DESC LIMIT 1
    `)
    expect(snapshots.rows).toHaveLength(1)

    const { restoreSnapshotAction } = await import('@/lib/actions/kosztorys-snapshots')
    await restoreSnapshotAction(Number(snapshots.rows[0].id), investmentId)

    expect(await sectionNames()).toEqual(['Stan sprzed importu'])
  })

  it('ignores a plan handed in by the caller and writes the one it derived itself', async () => {
    // The second parameter is the rozliczenie, never a plan — the action re-reads the sheet. Asserted
    // at runtime rather than only in the types, since a client can call a server action with any
    // argument list it likes.
    const forged = { sections: [{ id: 1, name: 'Podłożone przez klienta', displayOrder: 0 }] }
    await (applyKosztorysImport as unknown as (id: number, plan: unknown) => Promise<unknown>)(
      investmentId,
      forged,
    )

    expect(await sectionNames()).not.toContain('Podłożone przez klienta')
  })

  // The importer carries no role gate of its own: it sits at MANAGEMENT_ROLES like every other
  // kosztorys mutation (restore included, which replaces the whole tree the same way). This pins that
  // — a re-added ADMIN/OWNER narrowing would silently strip the feature from the role that runs the
  // sites day to day.
  it('lets a MANAGER preview and apply', async () => {
    authState.role = 'MANAGER'
    try {
      await seedSection('Zastąpiona przez managera')
      const preview = await previewKosztorysImport(investmentId)
      const applied = await applyKosztorysImport(investmentId)

      expect(preview).toMatchObject({ success: true })
      expect(applied).toMatchObject({ success: true })
      expect(await sectionNames()).not.toContain('Zastąpiona przez managera')
    } finally {
      authState.role = 'OWNER'
    }
  })

  it('reports a missing sheet link in Polish instead of importing nothing silently', async () => {
    sheetState.spreadsheetId = undefined
    try {
      expect(await previewKosztorysImport(investmentId)).toMatchObject({
        success: false,
        error: 'Inwestycja nie ma kosztorysu.',
      })
    } finally {
      sheetState.spreadsheetId = 'sheet-under-test'
    }
  })

  it('previews the same counts the import would write, without shipping the tree', async () => {
    const preview = await previewKosztorysImport(investmentId)

    expect(preview).toMatchObject({ success: true })
    if (!preview.success) return
    expect(preview.data.report.counts).toMatchObject({ sections: 2, items: 3, stages: 3 })
    expect(preview.data).not.toHaveProperty('tree')
  })
})
