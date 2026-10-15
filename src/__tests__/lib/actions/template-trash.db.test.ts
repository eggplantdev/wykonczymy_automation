import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { listTemplates } from '@/lib/db/templates'
import { NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'

// A szablon in /kosz must vanish from every reader, come back intact, and leave nothing behind when
// deleted forever — its sections, prace and versions hang off it by cascade only.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const actions = await import('@/lib/actions/template-trash')
const { purgeTemplateTrash } = await import('@/lib/kosztorys/templates/purge-trash')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('template trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const templateIds: number[] = []
  const entryIds: number[] = []

  const nameOf = async (id: number) =>
    String((await db.execute(sql`SELECT name FROM templates WHERE id = ${id}`)).rows[0].name)

  const exists = async (id: number) =>
    (await db.execute(sql`SELECT 1 FROM templates WHERE id = ${id}`)).rows.length > 0

  const trashDaysAgo = (id: number, days: number) =>
    db.execute(sql`
      UPDATE templates SET trashed_at = now() - make_interval(days => ${days}) WHERE id = ${id}
    `)

  async function template(name: string): Promise<number> {
    const id = await createTestTemplate(payload, `template-trash ${name}`)
    templateIds.push(id)
    await addTestTemplateSection(payload, id, 'Salon', entryIds)
    return id
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    entryIds.push(await createTestCatalogueEntry(payload, 'template-trash Malowanie'))
  })

  afterAll(async () => {
    for (const id of templateIds) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  it('hides a trashed szablon from the list and brings it back on restore', async () => {
    const id = await template('restore')

    expect((await actions.trashTemplateAction(id)).success).toBe(true)
    expect((await listTemplates(db)).some((t) => t.id === id)).toBe(false)

    expect((await actions.restoreTemplateAction(id)).success).toBe(true)
    expect((await listTemplates(db)).some((t) => t.id === id)).toBe(true)
  })

  it('deletes forever only on the typed name, and the cascade takes the whole tree', async () => {
    const id = await template('forever')
    await db.execute(sql`
      INSERT INTO template_snapshots (template_id, kind, schema_version, payload)
      VALUES (${id}, 'auto', 1, '{"sections":[]}'::jsonb)
    `)
    await actions.trashTemplateAction(id)
    const name = await nameOf(id)

    expect(await actions.deleteTemplateForeverAction(id, '')).toEqual({
      success: false,
      error: NAME_MISMATCH_MESSAGE,
    })
    expect(await actions.deleteTemplateForeverAction(id, 'inna nazwa')).toEqual({
      success: false,
      error: NAME_MISMATCH_MESSAGE,
    })
    expect(await exists(id)).toBe(true)

    expect((await actions.deleteTemplateForeverAction(id, name)).success).toBe(true)
    expect(await exists(id)).toBe(false)
    const orphans = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM template_sections WHERE template_id = ${id}) AS sections,
        (SELECT count(*) FROM template_snapshots WHERE template_id = ${id}) AS snapshots
    `)
    expect(Number(orphans.rows[0].sections)).toBe(0)
    expect(Number(orphans.rows[0].snapshots)).toBe(0)
  })

  it('refuses to delete forever a szablon that is not in the trash', async () => {
    const id = await template('live')

    const result = await actions.deleteTemplateForeverAction(id, await nameOf(id))

    expect(result.success).toBe(false)
    expect(await exists(id)).toBe(true)
  })

  it('keeps holding the name while trashed', async () => {
    const id = await template('name-hold')
    await actions.trashTemplateAction(id)

    await expect(
      db.execute(sql`INSERT INTO templates (name) VALUES (${await nameOf(id)})`),
    ).rejects.toThrow()
  })

  it('purges past the retention and keeps a szablon trashed within it', async () => {
    const old = await template('purge-old')
    const recent = await template('purge-recent')
    await trashDaysAgo(old, 31)
    await trashDaysAgo(recent, 5)

    await purgeTemplateTrash(db)

    expect(await exists(old)).toBe(false)
    expect(await exists(recent)).toBe(true)
  })
})
