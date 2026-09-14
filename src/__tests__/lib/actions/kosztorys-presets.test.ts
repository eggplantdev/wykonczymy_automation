import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { acquireTestWorkshop } from '@/__tests__/helpers/workshop'

// „Wczytaj szablon" replaces a whole rozpiska behind an automatic snapshot, so the only assertions
// worth making are against PERSISTED state — a success result would hide a failed write, and the
// „odwracalne" guarantee is real only if the pre-reload snapshot actually restores.

const authState = vi.hoisted(() => ({ userId: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { reloadFromPresetAction, saveWorkshopPresetAction } =
  await import('@/lib/actions/kosztorys-presets')

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

  // The preset payload keeps full snapshot shape-parity, `settings` included, but applying those
  // would drag one job's pricing config onto another. Handing `restoreKosztorys` the CURRENT settings
  // is what neutralizes its write-back; this pins that the neutralization actually holds.
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

  // The case above never enters the transaction, so it says nothing about the safety argument the
  // whole design rests on: the snapshot is written on the transaction handle BEFORE the wipe, so a
  // throw during the insert must take the snapshot down with it rather than strand a restore point
  // for a state that was never replaced.
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

// The warsztat is ONE row shared by everyone, so „Zapisz" cannot trust the szablon the page was
// rendered with: between that render and this click someone else may have opened a different one
// into it. The pointer is therefore re-read at WRITE time, and the assertions are on the persisted
// payloads — a refusal that still wrote would look identical from the return value.
describe.skipIf(!ENV_READY)('saveWorkshopPresetAction — pointer guard (DB)', () => {
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
    const result = await saveWorkshopPresetAction(heldPresetId)

    expect(result).toMatchObject({ success: true })
    expect(await sectionNamesOf(heldPresetId)).toEqual([SECTION_NAME])
  })

  it('refuses — and writes nothing — when the warsztat holds a different szablon', async () => {
    const result = await saveWorkshopPresetAction(otherPresetId)

    expect(result).toMatchObject({ success: false })
    expect(await sectionNamesOf(otherPresetId)).toEqual([])
  })
})
