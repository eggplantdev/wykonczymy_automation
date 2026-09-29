import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { createTestTemplate } from '@/__tests__/helpers/template'

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

// A live szablon cannot hold a tree that breaks on insert — its own unique indexes stop it — so the
// rollback case swaps in a serialized tree whose etapy collide on (investment_id, ordinal), the
// cheapest way to make `restoreKosztorys` throw AFTER the wipe and the snapshot insert.
const serializeControl = vi.hoisted(() => ({ brokenId: 0, broken: null as unknown }))
vi.mock('@/lib/kosztorys/serialize-preset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kosztorys/serialize-preset')>()
  return {
    ...actual,
    serializeKosztorysAsPreset: vi.fn(
      async (...args: Parameters<typeof actual.serializeKosztorysAsPreset>) =>
        args[0] === serializeControl.brokenId
          ? (serializeControl.broken as SnapshotPayloadT)
          : actual.serializeKosztorysAsPreset(...args),
    ),
  }
})

const {
  createEmptyPresetAction,
  deletePresetAction,
  reloadFromPresetAction,
  renamePresetAction,
  savePresetAction,
} = await import('@/lib/actions/kosztorys-presets')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const NAME_TAKEN_MESSAGE = 'Szablon o tej nazwie już istnieje'
const NAME_IN_TRASH_MESSAGE = 'Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.'

async function moveToTrash(db: Awaited<ReturnType<typeof getDb>>, id: number): Promise<void> {
  await db.execute(sql`UPDATE investments SET trashed_at = now() WHERE id = ${id}`)
}

// Szablon names are unique across the whole shared DB, so every run takes its own.
const uniqueName = (name: string) => `${name} ${crypto.randomUUID().slice(0, 8)}`

const INVESTMENT_VAT = 8
const INVESTMENT_COEFFS = { wToolsCoeff: 1.4, ownToolsCoeff: 1.7 }
const INVESTMENT_DISCOUNT = 5000
// Deliberately different from the investment's own: a szablon must never carry its pricing config
// onto another job, so these values landing on the target would be the bug.
const TEMPLATE_SETTINGS = { wToolsCoeff: 0.11, ownToolsCoeff: 0.22, vatRate: 23 }

function brokenPresetPayload(): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 1, name: 'Z szablonu', displayOrder: 0, color: null }],
    items: [],
    stages: [
      { id: 1, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
      { id: 2, ordinal: 1, label: 'Etap 1 znowu', plane: null, workerId: null },
    ],
    progress: [],
    settings: TEMPLATE_SETTINGS,
  }
}

async function firstUserId(payload: Payload): Promise<number> {
  const users = await payload.find({
    collection: 'users',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const firstUser = users.docs[0]
  if (!firstUser) throw new Error('no user in the DB to attribute the action to')
  return Number(firstUser.id)
}

// A delete spec removes some of its own fixtures, so teardown skips the ones already gone.
async function deleteIfPresent(
  payload: Payload,
  db: Awaited<ReturnType<typeof getDb>>,
  id: number,
) {
  const res = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id}`)
  if (res.rows.length > 0) await deleteTestInvestment(payload, id)
}

describe.skipIf(!ENV_READY)('reloadFromPresetAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let presetId: number
  let presetName: string
  let brokenPresetId: number
  let ordinaryId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    investmentId = await createTestInvestment(payload, 'ex560-reload-preset-test', {
      vatRate: INVESTMENT_VAT,
      wToolsCoeff: INVESTMENT_COEFFS.wToolsCoeff,
      ownToolsCoeff: INVESTMENT_COEFFS.ownToolsCoeff,
    })

    presetName = uniqueName('ex560-reload-fixture')
    presetId = await createTestInvestment(payload, presetName, {
      status: TEMPLATE_INVESTMENT_STATUS,
      ...TEMPLATE_SETTINGS,
    })
    // The szablon's own przedmiar and rabat — typed into its editor like on any kosztorys — must not
    // ride along into the investment it is loaded into.
    await createKosztorysTree(payload, presetId, {
      sections: [
        {
          name: 'Z szablonu',
          items: [
            {
              description: 'Praca z szablonu',
              unit: 'm2',
              plannedQty: 9,
              clientPrice: 100,
              discountType: 'percent',
              discountValue: 10,
            },
          ],
        },
      ],
    })
    brokenPresetId = await createTestTemplate(payload, 'ex560-reload-fixture-broken')
    serializeControl.brokenId = brokenPresetId
    serializeControl.broken = brokenPresetPayload()

    ordinaryId = await createTestInvestment(payload, 'ex560-reload-ordinary-source')
    await createKosztorysTree(payload, ordinaryId, { sections: [{ name: 'Cudza rozpiska' }] })
  })

  afterAll(async () => {
    for (const id of [investmentId, presetId, brokenPresetId, ordinaryId]) {
      if (id) await deleteTestInvestment(payload, id)
    }
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
        AND label = ${`Przed wczytaniem: ${presetName}`}
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

  it('takes the szablon’s rozpiska without its przedmiar and rabat', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)

    const res = await db.execute(sql`
      SELECT planned_qty, discount_type, discount_value, client_price FROM kosztorys_items
      WHERE investment_id = ${investmentId}
    `)
    expect(res.rows.map((row) => Number(row.client_price))).toEqual([100])
    expect(res.rows[0]).toMatchObject({ discount_type: null })
    expect(Number(res.rows[0].planned_qty)).toBe(0)
    expect(Number(res.rows[0].discount_value)).toBe(0)
  })

  // The szablon is an investment with its own VAT and coefficients, but applying those would drag
  // its pricing config onto another job — `restoreKosztorys` is handed the CURRENT settings instead.
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

  // Only a szablon is a source: an ordinary investment's id would copy a client's rozpiska into
  // someone else's, and the investment itself would only lose its przedmiar.
  it.each([
    ['does not exist', () => 2_000_000_000],
    ['is an ordinary investment', () => ordinaryId],
    ['is the investment itself', () => investmentId],
  ])('writes nothing — not even a snapshot — when the source %s', async (_, sourceId) => {
    await seedLiveTree()
    const before = await allSnapshotIds()

    const result = await reloadFromPresetAction(investmentId, sourceId())

    expect(result).toMatchObject({ success: false, error: 'Nie znaleziono szablonu' })
    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    expect(await allSnapshotIds()).toEqual(before)
  })

  // Thrown away means gone from „Wczytaj szablon" — an open picker must not still load it.
  it('writes nothing when the source szablon is in the trash', async () => {
    const trashed = await createTestTemplate(payload, 'ex560-reload-fixture-trashed')
    try {
      await createKosztorysTree(payload, trashed, { sections: [{ name: 'Z kosza' }] })
      await moveToTrash(db, trashed)
      await seedLiveTree()
      const before = await allSnapshotIds()

      expect(await reloadFromPresetAction(investmentId, trashed)).toMatchObject({
        success: false,
        error: 'Nie znaleziono szablonu',
      })
      expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
      expect(await allSnapshotIds()).toEqual(before)
    } finally {
      await deleteTestInvestment(payload, trashed)
    }
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

// A szablon is an investment with status `szablon`, so every lifecycle assertion reads the
// investments row and its tree — never the action's result alone.
describe.skipIf(!ENV_READY)('szablon lifecycle — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []
  let sourceId: number
  let sourceName: string

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    sourceName = uniqueName('lifecycle-source')
    sourceId = await createTestInvestment(payload, sourceName)
    created.push(sourceId)
    await createKosztorysTree(payload, sourceId, {
      sections: [
        {
          name: 'Łazienka',
          items: [
            {
              description: 'Płytki',
              unit: 'm2',
              plannedQty: 14,
              clientPrice: 120,
              discountType: 'amount',
              discountValue: 50,
            },
          ],
        },
      ],
      stages: [{ label: 'Etap 1' }],
    })
  })

  afterAll(async () => {
    for (const id of created) await deleteIfPresent(payload, db, id)
  })

  async function templateByName(name: string) {
    const res = await db.execute(sql`
      SELECT id, status, content_edited_at FROM investments WHERE name = ${name}
    `)
    for (const row of res.rows) created.push(Number(row.id))
    return res.rows
  }

  async function treeOf(id: number) {
    const sections = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${id} ORDER BY display_order
    `)
    const items = await db.execute(sql`
      SELECT description, planned_qty, discount_type, discount_value FROM kosztorys_items
      WHERE investment_id = ${id} ORDER BY id
    `)
    const stages = await db.execute(sql`SELECT 1 FROM kosztorys_stages WHERE investment_id = ${id}`)
    return {
      sections: sections.rows.map((row) => String(row.name)),
      items: items.rows.map((row) => ({
        description: String(row.description),
        plannedQty: Number(row.planned_qty),
        discountType: row.discount_type,
        discountValue: Number(row.discount_value),
      })),
      stages: stages.rows.length,
    }
  }

  const STRIPPED_SOURCE_TREE = {
    sections: ['Łazienka'],
    items: [{ description: 'Płytki', plannedQty: 0, discountType: null, discountValue: 0 }],
    stages: 0,
  }

  it('an empty szablon is a stamped szablon investment with no tree', async () => {
    const name = uniqueName('lifecycle-empty')

    const result = await createEmptyPresetAction(name)

    const rows = await templateByName(name)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe(TEMPLATE_INVESTMENT_STATUS)
    // Stamped, or a new szablon would sort below every edited one on the list it was made from.
    expect(rows[0].content_edited_at).not.toBeNull()
    expect(result).toEqual({ success: true, data: { id: Number(rows[0].id) } })
    expect((await treeOf(Number(rows[0].id))).sections).toEqual([])
  })

  it('„Zapisz jako nowy” founds a szablon with the source’s rozpiska, job figures stripped', async () => {
    const name = uniqueName('lifecycle-new')

    expect(await savePresetAction(sourceId, { mode: 'new', name })).toEqual({ success: true })

    const rows = await templateByName(name)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe(TEMPLATE_INVESTMENT_STATUS)
    expect(await treeOf(Number(rows[0].id))).toEqual(STRIPPED_SOURCE_TREE)
  })

  // The unique index compares lower(trim(name)); the actions have to say so in Polish before the
  // driver answers with an English 23505.
  it.each([
    ['other case', (name: string) => name.toUpperCase()],
    ['edge spaces', (name: string) => `  ${name}  `],
  ])('refuses a taken name (%s) on every path that names a szablon', async (_, variant) => {
    const takenName = uniqueName('lifecycle-taken')
    const taken = await createTestInvestment(payload, takenName, {
      status: TEMPLATE_INVESTMENT_STATUS,
    })
    const other = await createTestTemplate(payload, 'lifecycle-rename-me')
    created.push(taken, other)

    const refused = { success: false, error: NAME_TAKEN_MESSAGE }
    expect(await createEmptyPresetAction(variant(takenName))).toEqual(refused)
    expect(await savePresetAction(sourceId, { mode: 'new', name: variant(takenName) })).toEqual(
      refused,
    )
    expect(await renamePresetAction(other, variant(takenName))).toEqual(refused)

    const sameName = await db.execute(sql`
      SELECT id FROM investments
      WHERE status = ${TEMPLATE_INVESTMENT_STATUS} AND lower(trim(name)) = lower(${takenName})
    `)
    expect(sameName.rows.map((row) => Number(row.id))).toEqual([taken])
  })

  // The trashed szablon is invisible, so „already exists" would point at nothing on the list.
  it('refuses a trashed szablon’s name, pointing at the trash, on every path that names a szablon', async () => {
    const trashedName = uniqueName('lifecycle-trashed')
    const trashed = await createTestInvestment(payload, trashedName, {
      status: TEMPLATE_INVESTMENT_STATUS,
    })
    const other = await createTestTemplate(payload, 'lifecycle-rename-into-trash')
    created.push(trashed, other)
    await moveToTrash(db, trashed)

    const refused = { success: false, error: NAME_IN_TRASH_MESSAGE }
    expect(await createEmptyPresetAction(trashedName)).toEqual(refused)
    expect(await savePresetAction(sourceId, { mode: 'new', name: trashedName })).toEqual(refused)
    expect(await renamePresetAction(other, trashedName)).toEqual(refused)

    const sameName = await db.execute(sql`
      SELECT id FROM investments
      WHERE status = ${TEMPLATE_INVESTMENT_STATUS} AND lower(trim(name)) = lower(${trashedName})
    `)
    expect(sameName.rows.map((row) => Number(row.id))).toEqual([trashed])
  })

  it('„Nadpisz” refuses a szablon in the trash and leaves its tree as it was', async () => {
    const trashed = await createTestTemplate(payload, 'lifecycle-overwrite-trashed')
    created.push(trashed)
    await createKosztorysTree(payload, trashed, { sections: [{ name: 'W koszu' }] })
    await moveToTrash(db, trashed)

    expect(await savePresetAction(sourceId, { mode: 'overwrite', targetId: trashed })).toEqual({
      success: false,
      error: 'Nie znaleziono szablonu',
    })
    expect((await treeOf(trashed)).sections).toEqual(['W koszu'])
  })

  it('„Nadpisz” replaces the target’s tree, leaves it a restore point and spares the source', async () => {
    const targetId = await createTestTemplate(payload, 'lifecycle-overwrite')
    created.push(targetId)
    await createKosztorysTree(payload, targetId, { sections: [{ name: 'Stara treść' }] })
    const sourceBefore = await treeOf(sourceId)

    expect(await savePresetAction(sourceId, { mode: 'overwrite', targetId })).toEqual({
      success: true,
    })

    expect(await treeOf(targetId)).toEqual(STRIPPED_SOURCE_TREE)
    expect(await treeOf(sourceId)).toEqual(sourceBefore)
    const points = await db.execute(sql`
      SELECT label FROM kosztorys_snapshots WHERE investment_id = ${targetId}
    `)
    expect(points.rows.map((row) => row.label)).toEqual([`Przed nadpisaniem: ${sourceName}`])
  })

  it.each([
    ['an ordinary investment', () => sourceId, 'Szablonu nie nadpisuje się nim samym'],
    ['a missing id', () => 2_000_000_000, 'Nie znaleziono szablonu'],
  ])('„Nadpisz” refuses %s as the target', async (_, targetId, error) => {
    const before = await treeOf(sourceId)

    expect(await savePresetAction(sourceId, { mode: 'overwrite', targetId: targetId() })).toEqual({
      success: false,
      error,
    })
    expect(await treeOf(sourceId)).toEqual(before)
  })

  it('„Nadpisz” refuses an ordinary investment other than the source', async () => {
    const ordinary = await createTestInvestment(payload, 'lifecycle-ordinary-target')
    created.push(ordinary)
    await createKosztorysTree(payload, ordinary, { sections: [{ name: 'Klienta' }] })

    expect(
      await savePresetAction(sourceId, { mode: 'overwrite', targetId: ordinary }),
    ).toMatchObject({ success: false, error: 'Nie znaleziono szablonu' })
    expect((await treeOf(ordinary)).sections).toEqual(['Klienta'])
  })

  // The cascade is the delete: a szablon's tree and its restore points have no owner once it goes.
  it('deleting a szablon takes its sections, items and restore points with it', async () => {
    const templateId = await createTestTemplate(payload, 'lifecycle-delete')
    created.push(templateId)
    await createKosztorysTree(payload, templateId, {
      sections: [{ name: 'Do usunięcia', items: [{ description: 'x', unit: 'm2' }] }],
    })
    await savePresetAction(sourceId, { mode: 'overwrite', targetId: templateId })

    expect(await deletePresetAction(templateId)).toEqual({ success: true })

    const left = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM investments WHERE id = ${templateId}) AS investments,
        (SELECT COUNT(*) FROM kosztorys_sections WHERE investment_id = ${templateId}) AS sections,
        (SELECT COUNT(*) FROM kosztorys_items WHERE investment_id = ${templateId}) AS items,
        (SELECT COUNT(*) FROM kosztorys_snapshots WHERE investment_id = ${templateId}) AS snapshots
    `)
    expect(left.rows[0]).toEqual({ investments: '0', sections: '0', items: '0', snapshots: '0' })
  })

  it('refuses to delete an ordinary investment through the szablon list', async () => {
    const ordinary = await createTestInvestment(payload, 'lifecycle-ordinary-delete')
    created.push(ordinary)

    expect(await deletePresetAction(ordinary)).toEqual({
      success: false,
      error: 'Nie znaleziono szablonu',
    })
    const res = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${ordinary}`)
    expect(res.rows).toHaveLength(1)
  })
})
