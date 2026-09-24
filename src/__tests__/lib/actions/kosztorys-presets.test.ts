import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { acquireTestWorkshop } from '@/__tests__/helpers/workshop'

// „Wczytaj szablon" replaces a whole rozpiska behind an automatic snapshot, so every assertion is on
// PERSISTED state: a success result would hide a failed write, and „odwracalne" is real only if the
// pre-reload snapshot actually restores.

const authState = vi.hoisted(() => ({ userId: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const {
  createEmptyPresetAction,
  openPresetInWorkshopAction,
  reloadFromPresetAction,
  flushWorkshopPresetAction,
} = await import('@/lib/actions/kosztorys-presets')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const PRESET_NAME = 'ex560-reload-fixture'
// A second szablon whose payload violates the (investment_id, ordinal) unique index — the cheapest
// way to make `restoreKosztorys` throw AFTER the wipe and the snapshot insert.
const BROKEN_PRESET_NAME = 'ex560-reload-fixture-broken'
const PRE_RELOAD_LABEL = `Przed wczytaniem: ${PRESET_NAME}`
const INVESTMENT_VAT = 8
const INVESTMENT_COEFFS = { wToolsCoeff: 1.4, ownToolsCoeff: 1.7 }
const INVESTMENT_DISCOUNT = 5000
// Deliberately absurd and different from the investment's own: a preset must never carry one job's
// pricing config onto another, so these values landing on the target would be the bug.
const PRESET_SETTINGS = { wToolsCoeff: 0.11, ownToolsCoeff: 0.22, vatRate: 99 }

function presetPayload(): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 1, name: 'Z szablonu', displayOrder: 0, color: null }],
    items: [
      {
        id: 1,
        sectionId: 1,
        displayOrder: 0,
        description: 'Praca z szablonu',
        unit: 'm2',
        plannedQty: 0,
        sheetMeasuredQty: null,
        discountType: null,
        discountValue: 0,
        clientPrice: 100,
        wToolsOverrideValue: null,
        ownToolsOverrideValue: null,
        wToolsOverrideCoeff: null,
        ownToolsOverrideCoeff: null,
        note: null,
      },
    ],
    stages: [],
    progress: [],
    settings: PRESET_SETTINGS,
  }
}

function brokenPresetPayload(): SnapshotPayloadT {
  return {
    ...presetPayload(),
    stages: [
      { id: 1, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
      { id: 2, ordinal: 1, label: 'Etap 1 znowu', plane: null, workerId: null },
    ],
  }
}

describe.skipIf(!ENV_READY)('reloadFromPresetAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let presetId: number
  let brokenPresetId: number

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

    investmentId = await createTestInvestment(payload, 'ex560-reload-preset-test', {
      vatRate: INVESTMENT_VAT,
      wToolsCoeff: INVESTMENT_COEFFS.wToolsCoeff,
      ownToolsCoeff: INVESTMENT_COEFFS.ownToolsCoeff,
    })

    const { upsertPresetByName } = await import('@/lib/db/presets')
    presetId = await upsertPresetByName(db, {
      name: PRESET_NAME,
      createdBy: authState.userId,
      payload: presetPayload(),
    })
    brokenPresetId = await upsertPresetByName(db, {
      name: BROKEN_PRESET_NAME,
      createdBy: authState.userId,
      payload: brokenPresetPayload(),
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await db.execute(
      sql`DELETE FROM kosztorys_presets WHERE name IN (${PRESET_NAME}, ${BROKEN_PRESET_NAME})`,
    )
  })

  // Every kind of row the wipe has to reach, so a partial wipe can't pass.
  async function seedLiveTree(): Promise<void> {
    await payload.delete({
      collection: 'kosztorys-sections',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'kosztorys-stages',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Stan sprzed wczytania', displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: Number(section.id),
        displayOrder: 0,
        description: 'Praca wpisana ręcznie',
        unit: 'm2',
        plannedQty: 12,
        clientPrice: 50,
        discountValue: 0,
      },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 1, label: 'Etap 1' },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'stage-progress',
      data: { item: Number(item.id), stage: Number(stage.id), qtyDone: 4 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
  }

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((row) => String(row.name))
  }

  async function stageLabels(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT label FROM kosztorys_stages WHERE investment_id = ${investmentId} ORDER BY ordinal
    `)
    return res.rows.map((row) => String(row.label))
  }

  async function progressQty(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT sp.qty_done FROM stage_progress sp
      JOIN kosztorys_stages st ON st.id = sp.stage_id
      WHERE st.investment_id = ${investmentId}
    `)
    return res.rows.map((row) => Number(row.qty_done))
  }

  async function investmentSettings() {
    const res = await db.execute(sql`
      SELECT vat_rate, w_tools_coeff, own_tools_coeff, global_discount_type, global_discount_value
      FROM investments WHERE id = ${investmentId}
    `)
    const row = res.rows[0]
    return {
      vatRate: Number(row.vat_rate),
      wToolsCoeff: Number(row.w_tools_coeff),
      ownToolsCoeff: Number(row.own_tools_coeff),
      discountType: row.global_discount_type,
      discountValue: Number(row.global_discount_value),
    }
  }

  async function setGlobalDiscount(value: number): Promise<void> {
    await db.execute(sql`
      UPDATE investments
      SET global_discount_type = 'amount', global_discount_value = ${value}
      WHERE id = ${investmentId}
    `)
  }

  async function preReloadSnapshotIds(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId}
        AND kind = 'manual'
        AND label = ${PRE_RELOAD_LABEL}
      ORDER BY id DESC
    `)
    return res.rows.map((row) => Number(row.id))
  }

  async function allSnapshotIds(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots WHERE investment_id = ${investmentId} ORDER BY id
    `)
    return res.rows.map((row) => Number(row.id))
  }

  it('replaces the whole rozpiska with the szablon, etapy and wykonano included', async () => {
    await seedLiveTree()

    const result = await reloadFromPresetAction(investmentId, presetId)

    expect(result).toMatchObject({ success: true, data: { sections: 1, items: 1 } })
    expect(await sectionNames()).toEqual(['Z szablonu'])
    // A szablon carries no etapy, so both go — this is the part that distinguishes a reload from the
    // sheet import, which keeps prace the sheet doesn't know about.
    expect(await stageLabels()).toEqual([])
    expect(await progressQty()).toEqual([])
  })

  // The preset payload keeps snapshot shape-parity, `settings` included, but applying those would drag
  // one job's pricing config onto another — `restoreKosztorys` is handed the CURRENT settings instead.
  it('leaves the investment’s own VAT and coefficients alone rather than taking the szablon’s', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)

    expect(await investmentSettings()).toMatchObject({
      vatRate: INVESTMENT_VAT,
      ...INVESTMENT_COEFFS,
    })
  })

  // A szablon's przedmiar is all zeroes, so a surviving amount discount would price the fresh
  // rozpiska below nothing — `globalDiscountAmount` is deliberately unclamped (calc.ts).
  it('zeroes the rabat globalny, which would otherwise outlive the work it discounts', async () => {
    await seedLiveTree()
    await setGlobalDiscount(INVESTMENT_DISCOUNT)

    await reloadFromPresetAction(investmentId, presetId)

    expect(await investmentSettings()).toMatchObject({ discountType: null, discountValue: 0 })
  })

  // Found by LABEL, not by „newest": the whole point of the pre-reload row being `manual` is that it
  // survives the auto count cap + 7-day GC and stays identifiable among the periodic autosaves.
  it('takes a labelled pre-reload snapshot that restores the rozpiska it replaced', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)
    expect(await sectionNames()).not.toContain('Stan sprzed wczytania')

    const snapshotIds = await preReloadSnapshotIds()
    expect(snapshotIds.length).toBeGreaterThan(0)

    const { restoreSnapshotAction } = await import('@/lib/actions/kosztorys-snapshots')
    await restoreSnapshotAction(snapshotIds[0], investmentId)

    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    // Etapy and wykonano come back too — the snapshot is the undo for the whole tree, not just the
    // prace, which is what makes the wipe safe to offer without an escalated warning.
    expect(await stageLabels()).toEqual(['Etap 1'])
    expect(await progressQty()).toEqual([4])
  })

  it('writes nothing — not even a snapshot — when the szablon does not exist', async () => {
    await seedLiveTree()
    const before = await preReloadSnapshotIds()

    const result = await reloadFromPresetAction(investmentId, 2_000_000_000)

    expect(result).toMatchObject({ success: false })
    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    expect(await preReloadSnapshotIds()).toEqual(before)
  })

  // The case above never enters the transaction. The snapshot is written on the transaction handle
  // BEFORE the wipe, so a throw during the insert must take it down rather than strand a restore
  // point for a state that was never replaced.
  it('rolls the pre-reload snapshot back when the insert itself throws', async () => {
    await seedLiveTree()
    const snapshotsBefore = await allSnapshotIds()

    const result = await reloadFromPresetAction(investmentId, brokenPresetId)

    expect(result).toMatchObject({ success: false })
    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    expect(await stageLabels()).toEqual(['Etap 1'])
    expect(await progressQty()).toEqual([4])
    expect(await allSnapshotIds()).toEqual(snapshotsBefore)
  })
})

// The warsztat is ONE row shared by everyone, so between the render and the flush someone may have
// opened a different szablon in it. The pointer is read at the moment of the WRITE, and the
// assertions go to the stored payloads — a step-aside that wrote anyway looks identical in the
// action's result.
describe.skipIf(!ENV_READY)('flushWorkshopPresetAction — strażnik wskaźnika (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workshop: Awaited<ReturnType<typeof acquireTestWorkshop>>
  let sectionId: number
  let heldPresetId: number
  let otherPresetId: number

  const SECTION_NAME = 'Sekcja w warsztacie'

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
    if (!firstUser) throw new Error('no user in the DB to attribute the save to')
    authState.userId = Number(firstUser.id)

    workshop = await acquireTestWorkshop(payload)
    // Real content in the warsztat, so „it saved nothing" is distinguishable from „both szablony
    // were empty anyway".
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: workshop.id, name: SECTION_NAME, displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    sectionId = Number(section.id)

    const { upsertPresetByName } = await import('@/lib/db/presets')
    heldPresetId = await upsertPresetByName(db, {
      name: 'warsztat-save-held',
      createdBy: authState.userId,
      payload: { ...presetPayload(), sections: [], items: [] },
    })
    otherPresetId = await upsertPresetByName(db, {
      name: 'warsztat-save-other',
      createdBy: authState.userId,
      payload: { ...presetPayload(), sections: [], items: [] },
    })

    const { setWorkshopPreset } = await import('@/lib/db/workshop-investment')
    await setWorkshopPreset(db, workshop.id, heldPresetId)
  })

  afterAll(async () => {
    if (sectionId) {
      await payload.delete({
        collection: 'kosztorys-sections',
        id: sectionId,
        context: { skipRevalidation: true },
        overrideAccess: true,
      })
    }
    await workshop.release()
    await db.execute(
      sql`DELETE FROM kosztorys_presets WHERE name IN ('warsztat-save-held', 'warsztat-save-other')`,
    )
  })

  async function sectionNamesOf(presetId: number): Promise<string[]> {
    const { getPreset } = await import('@/lib/db/presets')
    const preset = await getPreset(db, presetId)
    return (preset?.payload.sections ?? []).map((section) => section.name)
  }

  it('writes the warsztat’s content into the szablon it actually holds', async () => {
    const result = await flushWorkshopPresetAction(heldPresetId)

    expect(result).toMatchObject({ success: true })
    // Contains, not equals: the warsztat is BORROWED from production (see `acquireTestWorkshop`), so
    // whatever sekcje it already holds are part of its content and get written too. Pinning the exact
    // list would assert that prod's warsztat is empty, which it stopped being.
    expect(await sectionNamesOf(heldPresetId)).toContain(SECTION_NAME)
  })

  // The flush is fire-and-forget, so a step-aside is SILENT — the user clicked nothing that could
  // have failed. The only thing to check here is that the other szablon was left untouched.
  it('nie dotyka szablonu, którego warsztat nie trzyma', async () => {
    const result = await flushWorkshopPresetAction(otherPresetId)

    expect(result).toMatchObject({ success: true })
    expect(await sectionNamesOf(otherPresetId)).toEqual([])
  })

  // Opening a different szablon rewrites the warsztat tree in place — without the eviction flush,
  // the last change to the outgoing one would simply vanish, and without a trace.
  it('dopycha poprzedni szablon, zanim otwarcie przepisze drzewo warsztatu', async () => {
    const { setWorkshopPreset } = await import('@/lib/db/workshop-investment')
    const { updatePresetPayload } = await import('@/lib/db/presets')
    await setWorkshopPreset(db, workshop.id, heldPresetId)
    // Reset the szablon to empty, so the content found after the open can ONLY have come from the
    // eviction.
    await updatePresetPayload(db, {
      id: heldPresetId,
      payload: { ...presetPayload(), sections: [], items: [] },
    })
    expect(await sectionNamesOf(heldPresetId)).toEqual([])

    await openPresetInWorkshopAction(otherPresetId)

    expect(await sectionNamesOf(heldPresetId)).toContain(SECTION_NAME)
    // The open wipes the warsztat tree along with our section — there is nothing left to clean up.
    sectionId = 0
  })

  // „Przełącz na inny szablon…" in the warsztat takes the same path as a click in the list, so what
  // the user sees after the switch hangs on two things at once: the pointer must name the new
  // szablon, and a restore point must exist before the tree is rewritten.
  it('przełączenie warsztatu przesuwa wskaźnik i zostawia punkt ochronny', async () => {
    const { getWorkshop } = await import('@/lib/db/workshop-investment')

    const result = await openPresetInWorkshopAction(heldPresetId)

    expect(result).toMatchObject({ success: true })
    expect((await getWorkshop(db))?.presetId).toBe(heldPresetId)
    // The label carries the name of the szablon being loaded — otherwise three switches give three
    // indistinguishable rows under „Wersje".
    const snapshots = await db.execute(
      sql`SELECT label FROM kosztorys_snapshots WHERE investment_id = ${workshop.id}
          ORDER BY taken_at DESC, id DESC LIMIT 1`,
    )
    expect(snapshots.rows[0]?.label).toBe('Przed wczytaniem: warsztat-save-held')
  })

  // The eviction race. The tree swap runs in its own transaction, so if the pointer still named the
  // OUTGOING szablon while that ran, there would be a committed state — tree already the incoming
  // one, pointer still the outgoing one — in which a flush passes every guard and stamps the new
  // content into the old szablon's row, destroying it. The ordering is the only thing that closes
  // it, and a switch that FAILS is where the ordering becomes observable: the pointer is already
  // down, so it cannot come back up naming a szablon whose tree the warsztat no longer has.
  it('opuszcza wskaźnik, zanim drzewo ruszy — więc nieudane przełączenie nie zostawia starego', async () => {
    const { getWorkshop, setWorkshopPreset } = await import('@/lib/db/workshop-investment')
    await setWorkshopPreset(db, workshop.id, heldPresetId)

    const result = await openPresetInWorkshopAction(2_000_000_000)

    expect(result).toMatchObject({ success: false })
    expect((await getWorkshop(db))?.presetId).toBeNull()

    await setWorkshopPreset(db, workshop.id, heldPresetId)
  })
})

// Creating a szablon with no source kosztorys. Assertions go to the stored row and to the warsztat
// tree AFTER loading it: `insertPreset` returning an id says nothing about whether an empty payload
// survives `replaceTreeWithSnapshot`, which is the only real risk on this path.
describe.skipIf(!ENV_READY)('createEmptyPresetAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workshop: Awaited<ReturnType<typeof acquireTestWorkshop>>

  const EMPTY_PRESET_NAME = 'pusty-szablon-fixture'

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
    if (!firstUser) throw new Error('no user in the DB to attribute the preset to')
    authState.userId = Number(firstUser.id)

    workshop = await acquireTestWorkshop(payload)
    // Entering, not asserting: the szablon library is shared, so a leftover row from a failed run
    // would make the „nazwa zajęta" case pass for the wrong reason.
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name = ${EMPTY_PRESET_NAME}`)
  })

  afterAll(async () => {
    await workshop.release()
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name = ${EMPTY_PRESET_NAME}`)
  })

  async function storedPresets(): Promise<
    { id: number; schemaVersion: number; payload: SnapshotPayloadT }[]
  > {
    const res = await db.execute(sql`
      SELECT id, schema_version, payload FROM kosztorys_presets WHERE name = ${EMPTY_PRESET_NAME}
    `)
    return res.rows.map((row) => ({
      id: Number(row.id),
      schemaVersion: Number(row.schema_version),
      payload: row.payload as SnapshotPayloadT,
    }))
  }

  async function workshopSectionCount(): Promise<number> {
    const res = await db.execute(sql`
      SELECT COUNT(*) AS count FROM kosztorys_sections WHERE investment_id = ${workshop.id}
    `)
    return Number(res.rows[0].count)
  }

  it('stores one szablon with an empty tree under the current format', async () => {
    const result = await createEmptyPresetAction(EMPTY_PRESET_NAME)

    expect(result).toMatchObject({ success: true })
    const rows = await storedPresets()
    expect(rows).toHaveLength(1)
    expect(rows[0].schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION)
    expect(rows[0].payload.sections).toEqual([])
    expect(rows[0].payload.items).toEqual([])
    expect(result).toMatchObject({ data: { id: rows[0].id } })
  })

  it('refuses a name already in the library and leaves the single row alone', async () => {
    const result = await createEmptyPresetAction(EMPTY_PRESET_NAME)

    expect(result).toMatchObject({ success: false })
    expect(await storedPresets()).toHaveLength(1)
  })

  // „Otwórz" on a szablon with nothing in it: the warsztat has to come out EMPTY rather than throwing
  // on a tree with no sekcje to remap.
  it('loads into the warsztat as an empty rozpiska', async () => {
    const [preset] = await storedPresets()

    const result = await openPresetInWorkshopAction(preset.id)

    expect(result).toMatchObject({ success: true })
    expect(await workshopSectionCount()).toBe(0)
  })
})
