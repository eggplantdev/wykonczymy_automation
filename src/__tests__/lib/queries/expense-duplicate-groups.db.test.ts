import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload, Where } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import type { RoleT } from '@/lib/auth/roles'
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'
import type { DuplicateGroupsT } from '@/lib/queries/expense-duplicate-groups'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))
const authState = vi.hoisted(() => ({ role: 'OWNER' }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async (roles: readonly RoleT[]) =>
    roles.includes(authState.role as RoleT)
      ? { success: true, user: { id: 1, email: 'o@t.com', name: 'Owner', role: authState.role } }
      : { success: false, error: 'Brak uprawnień' },
  ),
}))

const { findExpenseDuplicateGroups } = await import('@/lib/queries/expense-duplicate-groups')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }
const FILENAME_PREFIX = 'ex-1026-groups-'

describe.skipIf(!ENV_READY)('findExpenseDuplicateGroups (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentA: number
  let investmentB: number
  let workerId: number
  let registerId: number
  let draftId: number
  const tx: Record<string, number> = {}

  const ctx = { context: { skipRevalidation: true } }

  // Raw INSERT: the transfer hooks (sheet sync, revalidation) have nothing to do with what is read here.
  async function insertTransaction(
    key: string,
    row: { amount: number; date: string; investment: number; number?: string; cancelled?: boolean },
  ) {
    const { rows } = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, source_register_id, investment_id,
        cancelled, document_number)
      VALUES (${`EX-1026 ${key}`}, ${row.amount}, ${row.date}::timestamptz, 'INVESTMENT_EXPENSE',
        ${registerId}, ${row.investment}, ${row.cancelled ?? false}, ${row.number ?? null})
      RETURNING id
    `)
    tx[key] = Number(rows[0].id)
  }

  const cleanup = async () => {
    await db.execute(sql`
      DELETE FROM worker_expense_drafts
      WHERE worker_id IN (SELECT id FROM users WHERE email = 'expense-groups@test.local')
    `)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await cleanup()
    await purgeFixtureUsers(db)

    investmentA = await createTestInvestment(payload, 'expense-duplicate-groups-a')
    investmentB = await createTestInvestment(payload, 'expense-duplicate-groups-b')
    ;({ ownerId: workerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Groups Worker', email: 'expense-groups@test.local', registerName: 'Kasa Groups' },
      ctx,
    ))

    await insertTransaction('inScope', {
      amount: 101.11,
      date: '2026-10-06T12:00:00Z',
      investment: investmentA,
      number: 'EX1026/TST/1',
    })
    await insertTransaction('twinElsewhere', {
      amount: 101.11,
      date: '2026-04-01T12:00:00Z',
      investment: investmentB,
      number: 'EX1026/TST/1',
    })
    await insertTransaction('cancelledTwin', {
      amount: 101.11,
      date: '2026-10-07T12:00:00Z',
      investment: investmentA,
      number: 'EX1026/TST/1',
      cancelled: true,
    })
    await insertTransaction('oldA', {
      amount: 202.22,
      date: '2026-03-02T12:00:00Z',
      investment: investmentB,
      number: 'EX1026/TST/2',
    })
    await insertTransaction('oldB', {
      amount: 202.22,
      date: '2026-03-03T12:00:00Z',
      investment: investmentB,
      number: 'EX1026/TST/2',
    })
    await insertTransaction('lastYear', {
      amount: 404.44,
      date: '2025-11-01T12:00:00Z',
      investment: investmentB,
      number: 'EX1026/TST/3',
    })
    await insertTransaction('weakTwin', {
      amount: 7777.77,
      date: '2026-08-01T12:00:00Z',
      investment: investmentB,
    })

    const { rows } = await db.execute(sql`
      INSERT INTO media (url, filename, mime_type, filesize, created_by_id)
      VALUES (${`https://blob.test/${FILENAME_PREFIX}0.jpg`}, ${`${FILENAME_PREFIX}0.jpg`}, 'image/jpeg', 1024, ${workerId}),
        (${`https://blob.test/${FILENAME_PREFIX}1.jpg`}, ${`${FILENAME_PREFIX}1.jpg`}, 'image/jpeg', 1024, ${workerId})
      RETURNING id
    `)
    const pages = rows.map((row) => Number(row.id))
    const inserted = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId: investmentA,
      cashRegisterId: registerId,
      note: null,
      mediaIds: pages,
    })
    if (inserted === null) throw new Error('draft fixture refused')
    draftId = inserted
    const aiRead = {
      rows: [
        { mediaIds: [pages[0]], documentNumber: 'EX1026/TST/3' },
        { mediaIds: [pages[1]], amount: 7777.77 },
      ],
    }
    await db.execute(sql`
      UPDATE worker_expense_drafts
      SET ai_read = ${JSON.stringify(aiRead)}::jsonb, sent_at = '2026-10-07T08:00:00Z'::timestamptz
      WHERE id = ${draftId}
    `)
  }, 30000)

  afterAll(async () => {
    if (!db) return
    await cleanup()
    await db.execute(sql`DELETE FROM transactions WHERE source_register_id = ${registerId}`)
    for (const id of [investmentA, investmentB]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
    await purgeFixtureUsers(db)
  })

  async function groupsOf(where: Where, range: DateRangeT = OCTOBER): Promise<DuplicateGroupsT> {
    authState.role = 'OWNER'
    const result = await findExpenseDuplicateGroups(where, range)
    if (!result.success) throw new Error(result.error)
    return result.data
  }

  // The shared test DB carries the restored dump's own duplicates, so only our fixtures are read.
  const ourGroups = (groups: DuplicateGroupsT['strong']) =>
    groups
      .map((group) =>
        group.members
          .filter((member) =>
            member.source === 'draft'
              ? member.id === draftId
              : Object.values(tx).includes(member.id),
          )
          .map((member) => member.key)
          .sort(),
      )
      .filter((keys) => keys.length > 0)

  it('finds an in-scope transakcja’s twin in another investment outside the range', async () => {
    const { strong } = await groupsOf({})
    expect(ourGroups(strong)).toContainEqual(
      [`transaction-${tx.inScope}`, `transaction-${tx.twinElsewhere}`].sort(),
    )
  })

  it('leaves out a pair with both sides outside the scope', async () => {
    const { strong } = await groupsOf({})
    expect(ourGroups(strong).flat()).not.toContain(`transaction-${tx.oldA}`)

    const allTime = await groupsOf({}, ALL_TIME)
    expect(ourGroups(allTime.strong)).toContainEqual(
      [`transaction-${tx.oldA}`, `transaction-${tx.oldB}`].sort(),
    )
  })

  it('the table’s filters narrow which transakcje are checked, never what they are compared with', async () => {
    const { strong } = await groupsOf({ investment: { equals: investmentA } }, ALL_TIME)
    const keys = ourGroups(strong).flat()
    expect(keys).toContain(`transaction-${tx.twinElsewhere}`)
    expect(keys).not.toContain(`transaction-${tx.oldA}`)
  })

  it('a pending paragon is checked whatever the table shows, against last year’s bookings too', async () => {
    const { strong, weak } = await groupsOf({ investment: { equals: investmentB } })
    expect(ourGroups(strong)).toContainEqual(
      [`draft-${draftId}-1`, `transaction-${tx.lastYear}`].sort(),
    )
    expect(ourGroups(weak)).toContainEqual(
      [`draft-${draftId}-2`, `transaction-${tx.weakTwin}`].sort(),
    )
  })

  it('a cancelled transakcja is never a member', async () => {
    const { strong, weak } = await groupsOf({}, ALL_TIME)
    expect([...ourGroups(strong), ...ourGroups(weak)].flat()).not.toContain(
      `transaction-${tx.cancelledTwin}`,
    )
  })

  it('refuses an EMPLOYEE', async () => {
    authState.role = 'EMPLOYEE'
    const result = await findExpenseDuplicateGroups({}, OCTOBER)
    expect(result.success).toBe(false)
  })
})
