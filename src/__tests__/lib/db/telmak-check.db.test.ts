import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { loadTelmakCheckRows } from '@/lib/db/telmak-check'

// Rows go in by raw SQL — the transfer hooks (sheet sync, revalidation) have nothing to do with what
// this statement reads.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-982 telmak check'
const RANGE = { from: '2026-09-01', to: '2026-09-30' }

describe.skipIf(!ENV_READY)('Telmak check rows (DB)', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  let otherRegisterId: number
  const ids: Record<string, number> = {}

  const cleanup = async () => {
    await db.execute(sql`
      DELETE FROM transactions WHERE source_register_id IN (
        SELECT id FROM cash_registers WHERE name LIKE ${MARKER + '%'})`)
    await db.execute(sql`DELETE FROM media WHERE filename = ${MARKER + '.pdf'}`)
    await db.execute(sql`DELETE FROM cash_registers WHERE name LIKE ${MARKER + '%'}`)
  }

  const insertRegister = async (name: string) => {
    const { rows } = await db.execute(sql`
      INSERT INTO cash_registers (name, owner_id, type)
      VALUES (${name}, (SELECT id FROM users ORDER BY id LIMIT 1), 'VIRTUAL') RETURNING id`)
    return Number(rows[0].id)
  }

  const insertRow = async (
    key: string,
    row: { register: number; date: string; note: string; type?: string },
  ) => {
    const { rows } = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, source_register_id, invoice_note)
      VALUES (${MARKER}, 100, ${row.date}, ${row.type ?? 'INVESTMENT_EXPENSE'}, ${row.register},
              ${row.note})
      RETURNING id`)
    ids[key] = Number(rows[0].id)
  }

  const load = (numbers: string[], range = RANGE) =>
    loadTelmakCheckRows(db, { registerId, ...range, numbers })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    db = await getDb(await getPayload({ config }))
    await cleanup()

    registerId = await insertRegister(MARKER)
    otherRegisterId = await insertRegister(`${MARKER} inna`)

    await insertRow('spaced', {
      register: registerId,
      date: '2026-09-05T12:00:00Z',
      note: '\t\n  wv 9-99001/tst/09/2026 \nFarba biała',
    })
    await insertRow('monthBefore', { register: registerId, date: '2026-08-05T12:00:00Z', note: '' })
    await insertRow('tooEarly', { register: registerId, date: '2026-07-20T12:00:00Z', note: '' })
    await insertRow('monthAfter', { register: registerId, date: '2026-10-29T12:00:00Z', note: '' })
    await insertRow('tooLate', { register: registerId, date: '2026-11-03T12:00:00Z', note: '' })
    await insertRow('elsewhere', {
      register: otherRegisterId,
      date: '2026-09-05T12:00:00Z',
      note: 'WV 9-99002/TST/09/2026',
    })
    await insertRow('cancellation', {
      register: registerId,
      date: '2026-09-06T12:00:00Z',
      note: 'WV 9-99001/TST/09/2026',
      type: 'CANCELLATION',
    })

    const { rows } = await db.execute(sql`
      INSERT INTO media (url, filename, mime_type)
      VALUES ('https://blob.test/telmak.pdf', ${MARKER + '.pdf'}, 'application/pdf') RETURNING id`)
    await db.execute(sql`
      INSERT INTO transactions_rels (parent_id, path, media_id, "order")
      VALUES (${ids.spaced}, 'invoice', ${Number(rows[0].id)}, 1)`)
  })

  afterAll(async () => {
    if (db) await cleanup()
  })

  const ourIds = (rows: { id: number }[]) =>
    rows.map((r) => r.id).filter((id) => Object.values(ids).includes(id))

  it('returns the register’s rows booked within a month either side of the range', async () => {
    expect(ourIds(await load([]))).toEqual([ids.spaced, ids.monthBefore, ids.monthAfter])
  })

  it('finds a row by its note’s first line, ignoring spaces and case', async () => {
    const rows = await load(['WV9-99001/TST/09/2026'], { from: '2025-01-01', to: '2025-01-31' })
    expect(ourIds(rows)).toEqual([ids.spaced])
  })

  it('returns another register’s row only when its number is asked for', async () => {
    expect(ourIds(await load([]))).not.toContain(ids.elsewhere)
    const rows = await load(['WV9-99002/TST/09/2026'])
    expect(rows.find((r) => r.id === ids.elsewhere)).toMatchObject({
      registerId: otherRegisterId,
      registerName: `${MARKER} inna`,
    })
  })

  it('never returns a CANCELLATION row, even by number', async () => {
    expect(ourIds(await load(['WV9-99001/TST/09/2026']))).not.toContain(ids.cancellation)
  })

  it('carries the attached invoice', async () => {
    const rows = await load([])
    expect(rows.find((r) => r.id === ids.spaced)?.invoices).toEqual([
      {
        id: expect.any(Number),
        url: 'https://blob.test/telmak.pdf',
        filename: `${MARKER}.pdf`,
        mimeType: 'application/pdf',
      },
    ])
    expect(rows.find((r) => r.id === ids.monthBefore)?.invoices).toEqual([])
  })
})
