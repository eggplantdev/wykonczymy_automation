import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { sumFilteredByType, sumRegisterBalance } from '@/lib/db/sum-transfers'
import { deriveFinancials } from '@/lib/db/investment-financials'
import { calculateBalance } from '@/lib/db/calculate-balance'
import {
  INVESTMENT_LOCKED_MESSAGE,
  LOCKED_INVESTMENT_STATUS,
} from '@/lib/constants/investment-lock'
import { BONUS_FORBIDDEN_MESSAGE } from '@/lib/auth/roles'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { pairRemaining } from '@/__tests__/helpers/pair-remaining'
import { warsawToday } from '@/lib/utils/days'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const {
  createTransferAction,
  createBulkTransferAction,
  cancelTransferAction,
  updateTransferAction,
} = await import('@/lib/actions/transfers')

// Stable, not timestamped: the entry cleanup has to find what a crashed run left behind.
const MARKER = 'EX-911 transfers-db'

type FiguresT = {
  registerA: number
  registerB: number
  income: number
  materials: number
  labor: number
  discount: number
  loss: number
  payouts: number
  bonus: number
  materialsNetDiscount: number
  balance: number
  remaining: number
}

describe.skipIf(!ENV_READY)('transfer actions on persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId = 0
  let lockedInvestmentId = 0
  let bulkInvestmentId = 0
  let workerId = 0
  let registerA = 0
  let registerB = 0
  let registerC = 0
  let expenseCategoryId = 0
  // W's „Pozostało" before any booking: the stage due comes from the kosztorys' own rates, which this
  // spec does not pin — only how each booking moves it.
  let due = 0
  // The ledger test leaves this as the state every cancel / edit below moves from.
  let expected: FiguresT
  const ctx = { context: { skipRevalidation: true } }
  const today = warsawToday()

  async function figures(): Promise<FiguresT> {
    const financials = deriveFinancials(
      await sumFilteredByType(payload, { investment: { equals: investmentId } }),
    )
    return {
      registerA: await sumRegisterBalance(payload, registerA),
      registerB: await sumRegisterBalance(payload, registerB),
      income: financials.totalIncome,
      materials: financials.totalMaterialCosts,
      labor: financials.totalLaborCosts,
      discount: financials.totalDiscount,
      loss: financials.totalLoss,
      payouts: financials.totalPayouts,
      bonus: financials.totalBonus,
      materialsNetDiscount: financials.materialsNetDiscount,
      balance: calculateBalance(financials),
      remaining: await pairRemaining(db, investmentId, workerId),
    }
  }

  const rowsDescribed = async (description: string) =>
    (
      await db.execute(sql`
        SELECT id, type::text AS type, amount::float8 AS amount, source_register_id,
          target_register_id, investment_id, worker_id, payment_method::text AS payment_method,
          payout_status::text AS payout_status
        FROM transactions WHERE description = ${description} ORDER BY id
      `)
    ).rows

  const countForInvestment = async (id: number) =>
    Number(
      (
        await db.execute(
          sql`SELECT COUNT(*)::int AS count FROM transactions WHERE investment_id = ${id}`,
        )
      ).rows[0].count,
    )

  async function cleanUp() {
    const doomed = sql`SELECT id FROM transactions WHERE description LIKE ${`${MARKER}%`}
      OR description LIKE ${`Anulowanie transakcji #%${MARKER}%`}`
    await db.execute(sql`DELETE FROM amount_edits WHERE transaction_id IN (${doomed})`)
    await db.execute(sql`DELETE FROM transactions WHERE id IN (${doomed})`)
    await db.execute(sql`
      UPDATE investments SET status = 'active' WHERE name LIKE ${`${MARKER}%`}
    `)
    const leftovers = await db.execute(
      sql`SELECT id FROM investments WHERE name LIKE ${`${MARKER}%`}`,
    )
    for (const row of leftovers.rows) {
      await deleteTestInvestment(payload, Number(row.id)).catch(() => {})
    }
    await purgeFixtureUsers(db)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await cleanUp()

    const [ownerId, categories] = await Promise.all([
      firstUserId(payload, { role: 'OWNER' }),
      payload.find({ collection: 'expense-categories', limit: 1, depth: 0, overrideAccess: true }),
    ])
    if (!categories.docs[0]) throw new Error('missing category')
    authState.userId = ownerId
    expenseCategoryId = Number(categories.docs[0].id)

    investmentId = await createTestInvestment(payload, `${MARKER} ledger`)
    lockedInvestmentId = await createTestInvestment(payload, `${MARKER} locked`)
    bulkInvestmentId = await createTestInvestment(payload, `${MARKER} bulk`)
    await db.execute(sql`
      UPDATE investments SET status = ${LOCKED_INVESTMENT_STATUS} WHERE id = ${lockedInvestmentId}
    `)
    ;({ ownerId: workerId, registerId: registerA } = await createRegisterOwner(
      payload,
      { name: 'Ledger W', email: 'transfers-db-a@test.local', registerName: 'Kasa A' },
      ctx,
    ))
    ;({ registerId: registerB } = await createRegisterOwner(
      payload,
      { name: 'Ledger B', email: 'transfers-db-b@test.local', registerName: 'Kasa B' },
      ctx,
    ))
    ;({ registerId: registerC } = await createRegisterOwner(
      payload,
      { name: 'Ledger C', email: 'transfers-db-c@test.local', registerName: 'Kasa C' },
      ctx,
    ))
    await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Sekcja', items: [{ description: 'pozycja', plannedQty: 10, clientPrice: 1000 }] },
      ],
      stages: [{ label: 'Etap 1', plane: 'w_tools', worker: workerId }],
      progress: [{ item: 0, stage: 0, qtyDone: 4 }],
    })
    due = await pairRemaining(db, investmentId, workerId)
  })

  afterEach(() => {
    authState.role = 'OWNER'
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await cleanUp()
  })

  const booking = (step: number, data: Omit<CreateTransferFormT, 'description' | 'date'>) => ({
    ...data,
    // Every booking offers a „Gotówka" so the SQL check below sees which types strip it.
    paymentMethod: 'CASH' as const,
    description: `${MARKER} step ${step}`,
    date: today,
  })

  it('moves each register, bucket, bilans and „Pozostało" by exactly the booked amount', async () => {
    expect(due).toBeGreaterThan(1_000)

    expected = {
      registerA: 0,
      registerB: 0,
      income: 0,
      materials: 0,
      labor: 0,
      discount: 0,
      loss: 0,
      payouts: 0,
      bonus: 0,
      materialsNetDiscount: 0,
      balance: 0,
      remaining: due,
    }
    expect(await figures(), 'step 0').toEqual(expected)

    const ledger: [CreateTransferFormT, Partial<FiguresT>][] = [
      [
        booking(1, {
          type: 'INVESTOR_DEPOSIT',
          amount: 10_000,
          sourceRegister: registerA,
          investment: investmentId,
        }),
        { registerA: 10_000, income: 10_000, balance: 10_000 },
      ],
      [
        booking(2, {
          type: 'INVESTMENT_EXPENSE',
          amount: 3_000,
          sourceRegister: registerA,
          investment: investmentId,
          expenseCategory: expenseCategoryId,
        }),
        { registerA: 7_000, materials: 3_000, balance: 7_000 },
      ],
      [
        booking(3, {
          type: 'CORRECTION',
          amount: -200,
          sourceRegister: registerA,
          investment: investmentId,
          expenseCategory: expenseCategoryId,
        }),
        { registerA: 7_200, materials: 2_800, balance: 7_200 },
      ],
      [
        booking(4, { type: 'LABOR_COST', amount: 5_000, investment: investmentId }),
        { labor: 5_000, balance: 2_200 },
      ],
      [
        booking(5, { type: 'RABAT', amount: 400, investment: investmentId }),
        { discount: 400, balance: 2_600 },
      ],
      [
        booking(6, { type: 'LOSS', amount: 150, investment: investmentId }),
        { loss: 150, balance: 2_750 },
      ],
      [
        booking(7, {
          type: 'PAYOUT',
          amount: 1_000,
          sourceRegister: registerA,
          investment: investmentId,
          worker: workerId,
        }),
        // a wypłata is not in bilans v1
        { registerA: 6_200, payouts: 1_000, remaining: due - 1_000 },
      ],
      [
        booking(8, { type: 'BONUS', amount: 300, investment: investmentId, worker: workerId }),
        // no kasa, no bilans
        { bonus: 300, remaining: due - 700 },
      ],
      [
        booking(9, {
          type: 'REGISTER_TRANSFER',
          amount: 500,
          sourceRegister: registerA,
          targetRegister: registerB,
        }),
        { registerA: 5_700, registerB: 500 },
      ],
    ]

    for (const [index, [data, moved]] of ledger.entries()) {
      const step = `step ${index + 1} ${data.type}`
      expect(await createTransferAction(data), step).toEqual({ success: true })
      expected = { ...expected, ...moved }
      expect(await figures(), step).toEqual(expected)
    }
  })

  it('persists only the columns each type carries', async () => {
    const persisted = await db.execute(sql`
      SELECT type::text AS type, source_register_id, target_register_id, investment_id,
        worker_id, payment_method::text AS payment_method, payout_status::text AS payout_status
      FROM transactions WHERE description LIKE ${`${MARKER} step %`} ORDER BY id
    `)
    const fromA = { source_register_id: registerA, target_register_id: null }
    const row = (type: string, carried: Record<string, unknown> = {}) => ({
      type,
      source_register_id: null,
      target_register_id: null,
      investment_id: investmentId,
      worker_id: null,
      payment_method: null,
      payout_status: null,
      ...carried,
    })
    expect(persisted.rows).toEqual([
      row('INVESTOR_DEPOSIT', { ...fromA, payment_method: 'CASH' }),
      row('INVESTMENT_EXPENSE', fromA),
      row('CORRECTION', fromA),
      row('LABOR_COST'),
      row('RABAT'),
      row('LOSS'),
      row('PAYOUT', { ...fromA, worker_id: workerId, payout_status: 'pending' }),
      row('BONUS', { worker_id: workerId }),
      row('REGISTER_TRANSFER', {
        source_register_id: registerA,
        target_register_id: registerB,
        investment_id: null,
      }),
    ])
  })

  it('refuses a premia booked by a MANAGER, persisting nothing', async () => {
    authState.role = 'MANAGER'
    const data = {
      ...booking(8, { type: 'BONUS', amount: 300, investment: investmentId, worker: workerId }),
      description: `${MARKER} manager bonus`,
    }

    expect(await createTransferAction(data)).toEqual({
      success: false,
      error: BONUS_FORBIDDEN_MESSAGE,
    })
    expect(await rowsDescribed(data.description)).toEqual([])
  })

  it('refuses a booking on a zakończona inwestycja, persisting nothing', async () => {
    const result = await createTransferAction({
      ...booking(0, { type: 'LABOR_COST', amount: 100, investment: lockedInvestmentId }),
      description: `${MARKER} locked`,
    })

    expect(result).toEqual({ success: false, error: INVESTMENT_LOCKED_MESSAGE })
    expect(await countForInvestment(lockedInvestmentId)).toBe(0)
  })

  const bulkExpense = (description: string, amounts: number[]) =>
    createBulkTransferAction({
      date: today,
      type: 'INVESTMENT_EXPENSE',
      paymentMethod: 'CASH',
      sourceRegister: registerC,
      investment: bulkInvestmentId,
      lineItems: amounts.map((amount) => ({
        description,
        amount,
        expenseCategory: expenseCategoryId,
      })),
    })

  it('books every bulk line and moves the kasa by their sum', async () => {
    const description = `${MARKER} bulk`

    expect(await bulkExpense(description, [100, 250.5, 49.5])).toEqual({ success: true })

    expect((await rowsDescribed(description)).map((row) => row.amount)).toEqual([100, 250.5, 49.5])
    expect(await sumRegisterBalance(payload, registerC)).toBe(-400)
  })

  it('rolls the whole bulk batch back when its second line fails', async () => {
    const description = `${MARKER} bulk rollback`
    const create = payload.create.bind(payload)
    let calls = 0
    vi.spyOn(payload, 'create').mockImplementation(((args: Parameters<Payload['create']>[0]) => {
      calls += 1
      if (calls === 2) throw new Error('line 2 failed')
      return create(args)
    }) as Payload['create'])

    const result = await bulkExpense(description, [70, 30])

    expect(result.success).toBe(false)
    expect(calls).toBe(2)
    expect(await rowsDescribed(description)).toEqual([])
    expect(await sumRegisterBalance(payload, registerC)).toBe(-400)
  })

  const stepId = async (step: number) =>
    Number(
      (
        await db.execute(
          sql`SELECT id FROM transactions WHERE description = ${`${MARKER} step ${step}`}`,
        )
      ).rows[0].id,
    )

  const isCancelled = async (id: number) =>
    (await db.execute(sql`SELECT cancelled FROM transactions WHERE id = ${id}`)).rows[0].cancelled

  const cancellationsOf = async (id: number) =>
    (
      await db.execute(sql`
        SELECT amount::float8 AS amount, source_register_id, target_register_id, investment_id,
          worker_id, date::date::text AS date, description
        FROM transactions WHERE type = 'CANCELLATION' AND cancelled_transaction_id = ${id}
      `)
    ).rows

  const amountEditsOf = async (id: number) =>
    (
      await db.execute(sql`
        SELECT previous_amount::float8 AS previous, new_amount::float8 AS next
        FROM amount_edits WHERE transaction_id = ${id}
      `)
    ).rows

  const reason = (step: number) => `${MARKER} cancel step ${step}`

  function failCreateWhen(matches: (args: Parameters<Payload['create']>[0]) => boolean) {
    const create = payload.create.bind(payload)
    vi.spyOn(payload, 'create').mockImplementation(((args: Parameters<Payload['create']>[0]) => {
      if (matches(args)) throw new Error('audit write failed')
      return create(args)
    }) as Payload['create'])
  }

  it('leaves the transfer live when its CANCELLATION row fails to write', async () => {
    const id = await stepId(5)
    failCreateWhen((args) => (args.data as { type?: string }).type === 'CANCELLATION')

    expect((await cancelTransferAction(id, { reason: reason(5) })).success).toBe(false)

    expect(await isCancelled(id)).toBe(false)
    expect(await cancellationsOf(id)).toEqual([])
    expect(await figures()).toEqual(expected)
  })

  it('cancels a rabat: bilans drops by it, one CANCELLATION row mirrors it', async () => {
    const id = await stepId(5)

    expect(await cancelTransferAction(id, { reason: reason(5) })).toEqual({ success: true })

    expect(await isCancelled(id)).toBe(true)
    expect(await cancellationsOf(id)).toEqual([
      {
        amount: 400,
        source_register_id: null,
        target_register_id: null,
        investment_id: null,
        worker_id: null,
        date: warsawToday(),
        description: `Anulowanie transakcji #${id}\n${reason(5)}`,
      },
    ])
    expected = { ...expected, discount: 0, balance: 2_350 }
    expect(await figures()).toEqual(expected)
  })

  it('cancels a materials expense: the kasa gets it back, materiały and bilans follow', async () => {
    expect(await cancelTransferAction(await stepId(2), { reason: reason(2) })).toEqual({
      success: true,
    })

    expected = { ...expected, registerA: 8_700, materials: -200, balance: 5_350 }
    expect(await figures()).toEqual(expected)
  })

  it('cancels a negative korekta, storing a negative CANCELLATION', async () => {
    const id = await stepId(3)

    expect(await cancelTransferAction(id, { reason: reason(3) })).toEqual({ success: true })

    expect((await cancellationsOf(id)).map((row) => row.amount)).toEqual([-200])
    expected = { ...expected, registerA: 8_500, materials: 0, balance: 5_150 }
    expect(await figures()).toEqual(expected)
  })

  it('cancels a premia: only „Pozostało" moves', async () => {
    expect(await cancelTransferAction(await stepId(8), { reason: reason(8) })).toEqual({
      success: true,
    })

    expected = { ...expected, bonus: 0, remaining: due - 1_000 }
    expect(await figures()).toEqual(expected)
  })

  it('refuses to cancel a transfer twice', async () => {
    const id = await stepId(5)

    expect(await cancelTransferAction(id, { reason: reason(5) })).toEqual({
      success: false,
      error: 'Transakcja jest już anulowana.',
    })
    expect(await cancellationsOf(id)).toHaveLength(1)
  })

  const editLabor = async (amount: number) =>
    updateTransferAction(await stepId(4), {
      description: `${MARKER} step 4`,
      date: today,
      amount,
    })

  it('keeps the old robocizna when its amount-edit row fails to write', async () => {
    failCreateWhen((args) => args.collection === 'amount-edits')

    expect((await editLabor(6_000)).success).toBe(false)

    expect(await amountEditsOf(await stepId(4))).toEqual([])
    expect(await figures()).toEqual(expected)
  })

  it('re-prices robocizna: bilans moves by the difference, one amount edit is logged', async () => {
    expect(await editLabor(6_000)).toEqual({ success: true })

    expect(await amountEditsOf(await stepId(4))).toEqual([{ previous: 5_000, next: 6_000 }])
    expected = { ...expected, labor: 6_000, balance: 4_150 }
    expect(await figures()).toEqual(expected)
  })

  it('cancels once when two cancels of the same transfer race', async () => {
    const id = await stepId(6)

    const results = await Promise.all([
      cancelTransferAction(id, { reason: reason(6) }),
      cancelTransferAction(id, { reason: reason(6) }),
    ])

    expect(results).toContainEqual({ success: true })
    expect(results).toContainEqual({ success: false, error: 'Transakcja jest już anulowana.' })
    expect(await cancellationsOf(id)).toHaveLength(1)
    expected = { ...expected, loss: 0, balance: 4_000 }
    expect(await figures()).toEqual(expected)
  })
})
