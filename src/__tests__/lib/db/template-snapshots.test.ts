import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { readTemplateLayout } from '@/lib/db/template-structure'
import { gcTemplateSnapshots, insertTemplateSnapshot } from '@/lib/db/template-snapshots'
import type { SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'

// A szablon version holds katalog refs only, so the risks are on the way back: a restore must
// rebuild the layout, leave its own restore point, and survive a ref whose katalog entry is gone.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const actions = await import('@/lib/actions/template-snapshots')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('template snapshots (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const templateIds: number[] = []
  const entryIds: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)
    for (const description of ['Gruntowanie', 'Malowanie', 'Fugowanie']) {
      entryIds.push(await createTestCatalogueEntry(payload, `template-snapshots ${description}`))
    }
  })

  afterAll(async () => {
    for (const id of templateIds) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  async function template(name: string): Promise<number> {
    const id = await createTestTemplate(payload, `template-snapshots ${name}`)
    templateIds.push(id)
    return id
  }

  it('saves a named version and lists it with its author', async () => {
    const templateId = await template('list')
    await addTestTemplateSection(payload, templateId, 'Salon', [entryIds[0]])

    expect((await actions.saveTemplateSnapshotAction(templateId, 'Przed zmianą')).success).toBe(
      true,
    )
    expect((await actions.templateSnapshotAction(templateId)).success).toBe(true)

    const listed = await actions.listTemplateSnapshotsAction(templateId)
    expect(listed.success && listed.data.map((s) => s.kind)).toEqual(['auto', 'named'])
    expect(listed.success && listed.data[1].label).toBe('Przed zmianą')
    expect(listed.success && listed.data[1].takenByName).not.toBeNull()
  })

  it('restores the layout and leaves the replaced one as an auto restore point', async () => {
    const templateId = await template('restore')
    await addTestTemplateSection(payload, templateId, 'Salon', [entryIds[0], entryIds[1]])
    await actions.saveTemplateSnapshotAction(templateId, 'v1')
    const saved = await readTemplateLayout(db, templateId)
    await db.execute(sql`DELETE FROM template_sections WHERE template_id = ${templateId}`)
    await addTestTemplateSection(payload, templateId, 'Kuchnia', [entryIds[2]])
    const listed = await actions.listTemplateSnapshotsAction(templateId)
    const named = listed.success ? listed.data.find((s) => s.kind === 'named') : undefined

    const restored = await actions.restoreTemplateSnapshotAction(named!.id, templateId)

    expect(restored).toEqual({
      success: true,
      data: { droppedWorkerAssignments: 0, skippedCatalogueItems: 0 },
    })
    expect(await readTemplateLayout(db, templateId)).toEqual(saved)
    const after = await actions.listTemplateSnapshotsAction(templateId)
    expect(after.success && after.data[0].kind).toBe('auto')
  })

  it('skips a praca whose katalog entry was deleted and counts it', async () => {
    const templateId = await template('deleted-entry')
    const doomed = await createTestCatalogueEntry(payload, 'template-snapshots doomed')
    await addTestTemplateSection(payload, templateId, 'Salon', [entryIds[0], doomed])
    await actions.saveTemplateSnapshotAction(templateId, 'v1')
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE id = ${doomed}`)
    const listed = await actions.listTemplateSnapshotsAction(templateId)
    const named = listed.success ? listed.data.find((s) => s.kind === 'named') : undefined

    const restored = await actions.restoreTemplateSnapshotAction(named!.id, templateId)

    expect(restored.success && restored.data.skippedCatalogueItems).toBe(1)
    expect(await readTemplateLayout(db, templateId)).toEqual({
      sections: [{ name: 'Salon', color: null, catalogueItemIds: [entryIds[0]] }],
    })
  })

  it('refuses a version of another szablon', async () => {
    const own = await template('own')
    const other = await template('other')
    await actions.saveTemplateSnapshotAction(other, 'obcy')
    const listed = await actions.listTemplateSnapshotsAction(other)
    const foreign = listed.success ? listed.data[0].id : 0

    expect(await actions.restoreTemplateSnapshotAction(foreign, own)).toEqual({
      success: false,
      error: 'Nie znaleziono wersji',
    })
  })

  describe('gcTemplateSnapshots', () => {
    async function insertAt(
      templateId: number,
      kind: SnapshotKindT,
      daysAgo: number,
      hour: number,
    ) {
      const id = await insertTemplateSnapshot(db, {
        templateId,
        kind,
        label: kind === 'named' ? 'wersja' : null,
        takenBy: null,
        payload: { sections: [] },
      })
      await db.execute(sql`
        UPDATE template_snapshots SET taken_at = (
          date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw')
            - make_interval(days => ${daysAgo})
            + make_interval(hours => ${hour})
        ) AT TIME ZONE 'Europe/Warsaw'
        WHERE id = ${id}
      `)
      return id
    }

    const survives = async (id: number) =>
      (await db.execute(sql`SELECT 1 FROM template_snapshots WHERE id = ${id}`)).rows.length > 0

    it('keeps the bands: recent all, one auto per day past 30 days, nothing auto past a year', async () => {
      const templateId = await template('gc')
      const otherTemplateId = await template('gc-other')
      const recentEarly = await insertAt(templateId, 'auto', 2, 9)
      const recentLate = await insertAt(templateId, 'auto', 2, 15)
      const oldEarly = await insertAt(templateId, 'auto', 60, 9)
      const oldLate = await insertAt(templateId, 'auto', 60, 15)
      const otherSameDay = await insertAt(otherTemplateId, 'auto', 60, 12)
      const ancient = await insertAt(templateId, 'auto', 400, 12)
      const ancientNamed = await insertAt(templateId, 'named', 400, 12)

      await gcTemplateSnapshots(db)

      expect(await survives(recentEarly)).toBe(true)
      expect(await survives(recentLate)).toBe(true)
      expect(await survives(oldEarly)).toBe(false)
      expect(await survives(oldLate)).toBe(true)
      expect(await survives(otherSameDay)).toBe(true)
      expect(await survives(ancient)).toBe(false)
      expect(await survives(ancientNamed)).toBe(true)
    })
  })
})
