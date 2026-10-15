import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  getTemplateRecordName,
  isLiveTemplate,
  listTemplateNamesByCatalogueItem,
  listTemplateSections,
  listTemplates,
  markTemplateEdited,
  renameTemplate,
  templateNameHolder,
  templateOwnersOfSections,
} from '@/lib/db/templates'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

async function bootPayload() {
  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  return getPayload({ config })
}

const trash = (db: Awaited<ReturnType<typeof getDb>>, id: number) =>
  db.execute(sql`UPDATE templates SET trashed_at = now() WHERE id = ${id}`)

// listTemplateSections counts prace per section in SQL (EX-622), so its tallies and ordering are
// only real against Postgres — assert the returned metas, never the plan.
describe.skipIf(!ENV_READY)('listTemplateSections (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const templates: number[] = []
  const entries: number[] = []
  let idA: number
  let idB: number
  let sectionsA: number[]
  let sectionB: number

  beforeAll(async () => {
    payload = await bootPayload()
    db = await getDb(payload)
    for (let i = 0; i < 3; i++) entries.push(await createTestCatalogueEntry(payload, `ex622-${i}`))

    // A: three sections, the middle one empty, and TWO sharing displayOrder 1 so the id tiebreaker is
    // exercised rather than assumed. B is created second, so it lists first.
    idA = await createTestTemplate(payload, 'ex622-fixture-a')
    idB = await createTestTemplate(payload, 'ex622-fixture-b')
    templates.push(idA, idB)
    sectionsA = [
      (
        await addTestTemplateSection(payload, idA, 'sekcja-10', entries.slice(0, 2), {
          displayOrder: 1,
        })
      ).sectionId,
      (await addTestTemplateSection(payload, idA, 'sekcja-11', [], { displayOrder: 1 })).sectionId,
      (await addTestTemplateSection(payload, idA, 'sekcja-12', entries.slice(0, 1))).sectionId,
    ]
    sectionB = (await addTestTemplateSection(payload, idB, 'sekcja-b', entries)).sectionId
  })

  afterAll(async () => {
    for (const id of templates) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, entries)
  })

  it('counts prace per live section', async () => {
    const metas = await listTemplateSections(db)

    const countsA = metas
      .filter((meta) => meta.templateId === idA)
      .map((meta) => [meta.sectionId, meta.itemCount])
    expect(countsA).toEqual([
      [sectionsA[2], 1],
      [sectionsA[0], 2],
      [sectionsA[1], 0],
    ])
    expect(metas.filter((meta) => meta.templateId === idB).map((meta) => meta.itemCount)).toEqual([
      3,
    ])
  })

  it('carries the szablon and section names onto every meta', async () => {
    const metas = await listTemplateSections(db)

    expect(metas.find((meta) => meta.sectionId === sectionB)).toMatchObject({
      templateId: idB,
      templateName: await getTemplateRecordName(db, idB),
      sectionName: 'sekcja-b',
    })
  })

  // The precondition the picker's grouping rests on (preset-picker-groups): interleaved metas would
  // split one szablon into two groups.
  it("returns one szablon's sections consecutively, newest szablon first", async () => {
    const metas = await listTemplateSections(db)

    const ours = metas.filter((meta) => meta.templateId === idA || meta.templateId === idB)
    expect(ours.map((meta) => meta.templateId)).toEqual([idB, idA, idA, idA])
  })
})

// Asserted on the persisted rows (via listTemplates), never on a return value — a success result can
// hide a failed write.
describe.skipIf(!ENV_READY)('renameTemplate / listTemplates (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []

  async function makeTemplate(name: string): Promise<number> {
    const id = await createTestTemplate(payload, name)
    created.push(id)
    return id
  }

  const nameOf = async (id: number) =>
    (await listTemplates(db)).find((template) => template.id === id)?.name

  const revisionOf = async (id: number) =>
    (await db.execute(sql`SELECT updated_at FROM templates WHERE id = ${id}`)).rows[0].updated_at

  const stampDaysAgo = (id: number, days: number | null) =>
    db.execute(
      days == null
        ? sql`UPDATE templates SET content_edited_at = NULL WHERE id = ${id}`
        : sql`UPDATE templates SET content_edited_at = now() - make_interval(days => ${days}) WHERE id = ${id}`,
    )

  beforeAll(async () => {
    payload = await bootPayload()
    db = await getDb(payload)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestTemplate(payload, id)
  })

  it('renames in place, keeping the id', async () => {
    const id = await makeTemplate('crud-fixture-old-name')
    const next = `crud-fixture-new-name ${id}`

    expect(await renameTemplate(db, id, next)).toBe(true)
    expect(await nameOf(id)).toBe(next)
  })

  // `updated_at` is the editor's remount token — a rename moving it would reset the owner's sort and
  // filters in an open editor.
  it('leaves updated_at alone', async () => {
    const id = await makeTemplate('crud-fixture-remount')
    const before = await revisionOf(id)

    await renameTemplate(db, id, `crud-fixture-remount-renamed ${id}`)

    expect(await revisionOf(id)).toEqual(before)
  })

  // The collision guard lives in SQL and matches the unique index — case and edge spaces don't make
  // a name new.
  it.each([
    ['same case', (name: string) => name],
    ['other case', (name: string) => name.toUpperCase()],
    ['edge spaces', (name: string) => `  ${name}  `],
  ])('refuses a taken name (%s) without touching either szablon', async (_, variant) => {
    const mine = await makeTemplate('crud-fixture-mine')
    const theirs = await makeTemplate('crud-fixture-theirs')
    const mineName = await nameOf(mine)
    const theirsName = (await nameOf(theirs))!

    expect(await templateNameHolder(db, variant(theirsName))).toBe('live')
    expect(await renameTemplate(db, mine, variant(theirsName))).toBe(false)
    expect(await nameOf(mine)).toBe(mineName)
    expect(await nameOf(theirs)).toBe(theirsName)
  })

  it('treats its own name as free when renaming itself', async () => {
    const id = await makeTemplate('crud-fixture-self')

    expect(await templateNameHolder(db, (await nameOf(id))!, id)).toBeUndefined()
  })

  // The listing sorts by the last edit, because that is the figure that moves. The trap is a szablon
  // migrated without a stamp: a plain DESC would drop it out of the view.
  it('sorts by the last edit and keeps an unstamped szablon in the list', async () => {
    const stale = await makeTemplate('crud-fixture-order-stale')
    const fresh = await makeTemplate('crud-fixture-order-fresh')
    const legacy = await makeTemplate('crud-fixture-order-legacy')
    await stampDaysAgo(stale, 2)
    await stampDaysAgo(fresh, 0)
    await stampDaysAgo(legacy, null)

    const ours = (await listTemplates(db)).filter((template) =>
      [stale, fresh, legacy].includes(template.id),
    )

    expect(ours.map((template) => template.id)).toEqual([fresh, stale, legacy])
    expect(ours.find((template) => template.id === legacy)?.updatedAt).toBeNull()
  })

  it('moves a renamed szablon to the top', async () => {
    const id = await makeTemplate('crud-fixture-stamp')
    await stampDaysAgo(id, 2)

    expect(await renameTemplate(db, id, `crud-fixture-stamp-renamed ${id}`)).toBe(true)
    expect((await listTemplates(db))[0]?.id).toBe(id)
  })

  // Every write into a szablon stamps it (templateAction); `updated_at` staying put is what keeps an
  // open editor from remounting under the user's hands.
  it('stamps an edit without moving updated_at', async () => {
    const id = await makeTemplate('crud-fixture-edited')
    await stampDaysAgo(id, 2)
    const before = await revisionOf(id)

    await markTemplateEdited(db, id)

    expect(await revisionOf(id)).toEqual(before)
    expect((await listTemplates(db))[0]?.id).toBe(id)
  })
})

// A trashed szablon is invisible to every reader until it is restored — a picker that still offered
// it would seed a kosztorys from something the user threw away. The name checks are the exception:
// the unique index still counts it.
describe.skipIf(!ENV_READY)('a trashed szablon (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []
  const entries: number[] = []
  let trashed: number
  let trashedName: string
  let trashedSection: number

  beforeAll(async () => {
    payload = await bootPayload()
    db = await getDb(payload)

    entries.push(await createTestCatalogueEntry(payload, 'trash-fixture-praca'))
    trashed = await createTestTemplate(payload, 'trash-fixture')
    created.push(trashed)
    trashedSection = (await addTestTemplateSection(payload, trashed, 'sekcja', entries)).sectionId
    trashedName = (await getTemplateRecordName(db, trashed))!
    await trash(db, trashed)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, entries)
  })

  it('is absent from the list and the section picker', async () => {
    expect((await listTemplates(db)).some((template) => template.id === trashed)).toBe(false)
    expect((await listTemplateSections(db)).some((meta) => meta.templateId === trashed)).toBe(false)
  })

  it('is not a szablon to any reader that names it', async () => {
    expect(await isLiveTemplate(db, trashed)).toBe(false)
    expect(await getTemplateRecordName(db, trashed)).toBeUndefined()
    expect((await templateOwnersOfSections(db, [trashedSection])).size).toBe(0)
  })

  it('cannot be renamed', async () => {
    expect(await renameTemplate(db, trashed, `trash-fixture-renamed ${trashed}`)).toBe(false)
    const row = await db.execute(sql`SELECT name FROM templates WHERE id = ${trashed}`)
    expect(row.rows[0].name).toBe(trashedName)
  })

  it('still holds its name, as trashed', async () => {
    expect(await templateNameHolder(db, trashedName.toUpperCase())).toBe('trashed')
  })

  it('keeps a live szablon from taking its name by rename', async () => {
    const live = await createTestTemplate(payload, 'trash-fixture-live')
    created.push(live)

    expect(await renameTemplate(db, live, trashedName)).toBe(false)
    expect(await templateNameHolder(db, trashedName, live)).toBe('trashed')
  })
})

describe.skipIf(!ENV_READY)('templateOwnersOfSections (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let template: number

  beforeAll(async () => {
    payload = await bootPayload()
    db = await getDb(payload)
    template = await createTestTemplate(payload, 'owners-fixture')
  })

  afterAll(async () => {
    await deleteTestTemplate(payload, template)
  })

  it("maps a szablon's section to it and ignores an id that is no szablon section", async () => {
    const { sectionId } = await addTestTemplateSection(payload, template, 'a', [])
    const missing = sectionId + 1_000_000

    const owners = await templateOwnersOfSections(db, [sectionId, missing])
    expect([...owners]).toEqual([[sectionId, template]])
  })
})

// „Szablony" on /katalog-prac is the length of this list, so a praca repeated in two sekcje of one
// szablon names it once, and a trashed szablon names nothing.
describe.skipIf(!ENV_READY)('listTemplateNamesByCatalogueItem (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []
  let entryId: number
  let live: number

  beforeAll(async () => {
    payload = await bootPayload()
    db = await getDb(payload)

    entryId = await createTestCatalogueEntry(payload, 'Szpachlowanie')
    live = await createTestTemplate(payload, 'catalogue-names-live')
    const trashed = await createTestTemplate(payload, 'catalogue-names-trashed')
    created.push(live, trashed)

    await addTestTemplateSection(payload, live, 'Salon', [entryId])
    await addTestTemplateSection(payload, live, 'Kuchnia', [entryId], { displayOrder: 1 })
    await addTestTemplateSection(payload, trashed, 'Salon', [entryId])
    await trash(db, trashed)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, [entryId])
  })

  it('names each live szablon once, however many sekcje repeat the praca', async () => {
    const names = await listTemplateNamesByCatalogueItem(db)
    expect(names[entryId]).toEqual([await getTemplateRecordName(db, live)])
  })
})
