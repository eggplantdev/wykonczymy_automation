import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  deletePreset,
  insertPreset,
  listPresetSections,
  listPresets,
  renamePreset,
} from '@/lib/db/presets'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// listPresetSections counts items per section in SQL (EX-622), so its per-section tallies and its
// ordering contract are only real against Postgres — assert the returned metas, never the plan.
describe.skipIf(!ENV_READY)('listPresetSections (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const presetNames = ['ex622-fixture-a', 'ex622-fixture-b']
  const presetIdByName = new Map<string, number>()

  function section(id: number, displayOrder: number): KosztorysSectionT {
    return {
      id,
      name: `sekcja-${id}`,
      displayOrder,
      color: null,
    }
  }

  function item(id: number, sectionId: number): KosztorysItemT {
    return {
      id,
      sectionId,
      displayOrder: id,
      description: `pozycja-${id}`,
      unit: 'm2',
      plannedQty: 1,
      sheetMeasuredQty: null,
      discountType: null,
      discountValue: 0,
      clientPrice: 100,
      wToolsOverrideValue: null,
      ownToolsOverrideValue: null,
      note: null,
    }
  }

  function presetPayload(sections: KosztorysSectionT[], items: KosztorysItemT[]): SnapshotPayloadT {
    return {
      schemaVersion: 1,
      sections,
      items,
      stages: [],
      progress: [],
      settings: { wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 },
    }
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // Preset A: three sections, the middle one empty, and TWO sharing displayOrder 1 so the
    // payload-array tiebreaker is exercised rather than assumed.
    const idA = await insertPreset(db, {
      name: presetNames[0],
      createdBy: null,
      payload: presetPayload(
        [section(10, 1), section(11, 1), section(12, 0)],
        [item(100, 10), item(101, 10), item(102, 12)],
      ),
    })
    // Preset B reuses section id 10 — a section id is only unique WITHIN its preset, so a count
    // keyed on sectionId alone would bleed A's items into B's row.
    const idB = await insertPreset(db, {
      name: presetNames[1],
      createdBy: null,
      payload: presetPayload([section(10, 0)], [item(200, 10), item(201, 10), item(202, 10)]),
    })
    if (idA == null || idB == null) throw new Error('fixture presets already exist — stale run?')
    presetIdByName.set(presetNames[0], idA)
    presetIdByName.set(presetNames[1], idB)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name LIKE 'ex622-fixture-%'`)
  })

  it('counts items per section within their own preset', async () => {
    const metas = await listPresetSections(db)
    const idA = presetIdByName.get(presetNames[0])
    const idB = presetIdByName.get(presetNames[1])

    const countsA = metas
      .filter((meta) => meta.presetId === idA)
      .map((meta) => [meta.sectionId, meta.itemCount])
    expect(countsA).toEqual([
      [12, 1],
      [10, 2],
      [11, 0],
    ])

    // Section id 10 again, but B's own three items — not A's two, and not all five.
    const countsB = metas
      .filter((meta) => meta.presetId === idB)
      .map((meta) => [meta.sectionId, meta.itemCount])
    expect(countsB).toEqual([[10, 3]])
  })

  it('carries the preset and section names onto every meta', async () => {
    const metas = await listPresetSections(db)
    const first = metas.find((meta) => meta.presetId === presetIdByName.get(presetNames[1]))

    expect(first).toMatchObject({ presetName: presetNames[1], sectionName: 'sekcja-10' })
  })

  // The precondition the picker's grouping rests on (preset-picker-groups): interleaved metas would
  // split one preset into two groups.
  it("returns one preset's sections consecutively, newest preset first", async () => {
    const metas = await listPresetSections(db)
    const idA = presetIdByName.get(presetNames[0])!
    const idB = presetIdByName.get(presetNames[1])!

    const ours = metas.filter((meta) => meta.presetId === idA || meta.presetId === idB)
    expect(ours.map((meta) => meta.presetId)).toEqual([idB, idA, idA, idA])
  })
})

// Delete and rename are the two operations that touch a szablon's EXISTENCE and its IDENTITY, so
// both are asserted on the persisted rows (via listPresets), never on a return value.
describe.skipIf(!ENV_READY)('deletePreset / renamePreset (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const emptyPayload: SnapshotPayloadT = {
    schemaVersion: 1,
    sections: [],
    items: [],
    stages: [],
    progress: [],
    settings: { wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 },
  }

  async function makePreset(name: string): Promise<number> {
    const id = await insertPreset(db, { name, createdBy: null, payload: emptyPayload })
    if (id == null) throw new Error(`fixture preset ${name} already exists — stale run?`)
    return id
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name LIKE 'crud-fixture-%'`)
  })

  it('removes the szablon from the library', async () => {
    const id = await makePreset('crud-fixture-doomed')

    expect(await deletePreset(db, id)).toBe(true)
    expect((await listPresets(db)).some((preset) => preset.id === id)).toBe(false)
  })

  it('reports a delete that matched nothing', async () => {
    const id = await makePreset('crud-fixture-gone')
    await deletePreset(db, id)

    expect(await deletePreset(db, id)).toBe(false)
  })

  it('renames in place, keeping the id', async () => {
    const id = await makePreset('crud-fixture-old-name')

    expect(await renamePreset(db, id, 'crud-fixture-new-name')).toBe(id)
    expect((await listPresets(db)).find((preset) => preset.id === id)?.name).toBe(
      'crud-fixture-new-name',
    )
  })

  // The collision guard lives in SQL, so the failure has to leave BOTH rows untouched — a partial
  // write here would be a szablon renamed onto a name it doesn't own.
  it('refuses a taken name without touching either szablon', async () => {
    const mine = await makePreset('crud-fixture-mine')
    const theirs = await makePreset('crud-fixture-theirs')

    expect(await renamePreset(db, mine, 'crud-fixture-theirs')).toBeNull()

    const byId = new Map((await listPresets(db)).map((preset) => [preset.id, preset.name]))
    expect(byId.get(mine)).toBe('crud-fixture-mine')
    expect(byId.get(theirs)).toBe('crud-fixture-theirs')
  })
})
