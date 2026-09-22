import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  claimPresetMirror,
  deletePreset,
  getPreset,
  insertPreset,
  listPresetSections,
  listPresets,
  renamePreset,
  updatePresetPayload,
} from '@/lib/db/presets'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// listPresetSections counts items per section in SQL (EX-622), so its tallies and ordering are only
// real against Postgres — assert the returned metas, never the plan.
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

// Asserted on the persisted rows (via listPresets), never on a return value — a success result can
// hide a failed write.
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

    expect(await renamePreset(db, id, 'crud-fixture-new-name')).toBe(true)
    expect((await listPresets(db)).find((preset) => preset.id === id)?.name).toBe(
      'crud-fixture-new-name',
    )
  })

  // „Zapisz" in the warsztat overwrites the szablon it HOLDS, by id — the name is not its address.
  it('overwrites the payload in place, keeping the id', async () => {
    const id = await makePreset('crud-fixture-overwritten')

    const filled: SnapshotPayloadT = {
      ...emptyPayload,
      sections: [{ id: 1, name: 'Nowa sekcja', displayOrder: 0, color: null }],
    }
    expect(await updatePresetPayload(db, { id, payload: filled })).toBe(true)

    const stored = await getPreset(db, id)
    expect(stored?.payload.sections.map((section) => section.name)).toEqual(['Nowa sekcja'])
  })

  // An UPDATE and not an upsert: someone deleting a szablon while another manager has it open in the
  // warsztat must not have it silently resurrected by that manager's next save.
  it('resurrects nothing when the szablon was deleted while it was open', async () => {
    const id = await makePreset('crud-fixture-deleted-under-us')
    await deletePreset(db, id)

    expect(await updatePresetPayload(db, { id, payload: emptyPayload })).toBe(false)
    expect((await listPresets(db)).some((preset) => preset.id === id)).toBe(false)
  })

  // Under autosave this runs unattended on every mutation, so „who created this szablon" would
  // drift into „who last hit a key" if the write touched created_by.
  it('leaves created_by alone and stamps updated_at', async () => {
    const author = await db.execute(sql`SELECT id FROM users ORDER BY id LIMIT 1`)
    const createdBy = author.rows[0] ? Number(author.rows[0].id) : null
    const id = await insertPreset(db, {
      name: 'crud-fixture-authored',
      createdBy,
      payload: emptyPayload,
    })
    if (id == null) throw new Error('fixture preset already exists — stale run?')

    await updatePresetPayload(db, { id, payload: emptyPayload })

    expect((await listPresets(db)).find((preset) => preset.id === id)?.createdBy).toBe(createdBy)
    const stamps = await db.execute(sql`SELECT updated_at FROM kosztorys_presets WHERE id = ${id}`)
    expect(stamps.rows[0]?.updated_at).not.toBeNull()
  })

  // The throttle is a CLAIM, not a read: two concurrent mutations both pass a „has the window
  // elapsed" SELECT, and only one may own the window.
  it('claims the mirror window once and refuses until it elapses', async () => {
    const id = await makePreset('crud-fixture-throttled')

    expect(await claimPresetMirror(db, id)).toBe(true)
    expect(await claimPresetMirror(db, id)).toBe(false)

    await db.execute(
      sql`UPDATE kosztorys_presets SET mirrored_at = now() - interval '1 hour' WHERE id = ${id}`,
    )
    expect(await claimPresetMirror(db, id)).toBe(true)
  })

  it('claims nothing for a szablon that is gone', async () => {
    const id = await makePreset('crud-fixture-claim-gone')
    await deletePreset(db, id)

    expect(await claimPresetMirror(db, id)).toBe(false)
  })

  // The listing sorts by the last edit, because that is the figure that moves under autosave — a
  // szablon is created once and worked on for weeks. The trap is the szablony that predate the
  // column: they carry no `updated_at` at all, and a plain DESC would drop them out of the view.
  // `legacy` fakes one by nulling the stamp back out, because creating a szablon now stamps it.
  it('sorts by the last edit and keeps a never-edited szablon in the list', async () => {
    const stale = await makePreset('crud-fixture-order-stale')
    const fresh = await makePreset('crud-fixture-order-fresh')
    const legacy = await makePreset('crud-fixture-order-legacy')

    await db.execute(
      sql`UPDATE kosztorys_presets SET updated_at = now() - interval '2 days' WHERE id = ${stale}`,
    )
    await db.execute(sql`UPDATE kosztorys_presets SET updated_at = now() WHERE id = ${fresh}`)
    await db.execute(sql`UPDATE kosztorys_presets SET updated_at = NULL WHERE id = ${legacy}`)

    const ours = (await listPresets(db)).filter((preset) =>
      [stale, fresh, legacy].includes(preset.id),
    )

    expect(ours.map((preset) => preset.id)).toEqual([fresh, stale, legacy])
    expect(ours.find((preset) => preset.id === legacy)?.updatedAt).toBeNull()
    expect(ours.find((preset) => preset.id === fresh)?.updatedAt).not.toBeNull()
  })

  // A szablon created a second ago is the one the owner is about to open, so it belongs at the TOP
  // of a list sorted by last edit — not in the NULLS-LAST tail reserved for rows predating the
  // column. Renaming is an edit too: the list is what it drives, so a rename has to move the row.
  it('stamps the modification date on creation and on a rename', async () => {
    const created = await makePreset('crud-fixture-stamp-created')

    const stamps = await db.execute(
      sql`SELECT updated_at FROM kosztorys_presets WHERE id = ${created}`,
    )
    expect(stamps.rows[0]?.updated_at).not.toBeNull()

    await db.execute(
      sql`UPDATE kosztorys_presets SET updated_at = now() - interval '2 days' WHERE id = ${created}`,
    )
    expect(await renamePreset(db, created, 'crud-fixture-stamp-renamed')).toBe(true)

    const after = await listPresets(db)
    expect(after[0]?.id).toBe(created)
  })

  // The collision guard lives in SQL, so a partial write would be a szablon renamed onto a name it
  // doesn't own.
  it('refuses a taken name without touching either szablon', async () => {
    const mine = await makePreset('crud-fixture-mine')
    const theirs = await makePreset('crud-fixture-theirs')

    expect(await renamePreset(db, mine, 'crud-fixture-theirs')).toBe(false)

    const byId = new Map((await listPresets(db)).map((preset) => [preset.id, preset.name]))
    expect(byId.get(mine)).toBe('crud-fixture-mine')
    expect(byId.get(theirs)).toBe('crud-fixture-theirs')
  })
})
