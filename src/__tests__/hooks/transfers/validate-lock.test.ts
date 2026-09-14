import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

// Transactions have no raw-SQL writer, so unlike the kosztorys this ONE hook is the complete gate —
// the panel, the REST API and every server action pass through it. The cases below are the four
// shapes a write can take (create / edit / anulowanie / przenosiny, both directions) plus the single
// deliberate hole: the scan of the faktura.
//
// The adapter double answers by investment id: LOCKED_ID is „zakończona", everything else is
// „aktywna" — the hook's whole question is which of the touched investments carries which status.
const LOCKED_ID = 99

function hookArgs(
  data: Record<string, unknown>,
  opts: { operation?: 'create' | 'update'; originalDoc?: Record<string, unknown> } = {},
) {
  const { operation = 'create', originalDoc } = opts
  return {
    data,
    operation,
    originalDoc,
    req: {
      user: { id: 1 },
      payload: {
        db: {
          drizzle: {
            execute: async (query: { queryChunks?: unknown[] }) => {
              // The id rides the statement as a bound parameter — a bare number among the SQL-text
              // chunks — so the double reads it back rather than re-parsing SQL.
              const id = (query.queryChunks ?? []).find((chunk) => typeof chunk === 'number')
              return { rows: [{ status: id === LOCKED_ID ? 'completed' : 'active' }] }
            },
          },
        },
      },
    },
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

const expense = {
  amount: 100,
  date: '2026-09-03',
  paymentMethod: 'CASH',
  type: 'INVESTMENT_EXPENSE',
  sourceRegister: 1,
  expenseCategory: 1,
}

describe('validateTransfer — the completed-investment lock', () => {
  it('refuses a new transaction booked on a locked investment', async () => {
    await expect(validateTransfer(hookArgs({ ...expense, investment: LOCKED_ID }))).rejects.toThrow(
      INVESTMENT_LOCKED_MESSAGE,
    )
  })

  it('lets a new transaction on an active investment through', async () => {
    await expect(validateTransfer(hookArgs({ ...expense, investment: 7 }))).resolves.not.toThrow()
  })

  // A PATCH of one field carries no relationship, so the gate has to read the investment off the
  // stored row — the case a `data.investment` check would wave straight through.
  it('refuses a partial edit that names no investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { amount: 200 },
          { operation: 'update', originalDoc: { ...expense, investment: LOCKED_ID } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  // Anulowanie is a write like any other, and it reaches the hook as `cancelled: true` — below the
  // gate's position, so this is what proves the gate sits above BOTH early returns.
  it('refuses cancelling a transaction on a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { cancelled: true },
          { operation: 'update', originalDoc: { ...expense, investment: LOCKED_ID } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses the CANCELLATION row itself when it names a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs({
          ...expense,
          type: 'CANCELLATION',
          cancelledTransaction: 5,
          investment: LOCKED_ID,
        }),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses moving a transaction ONTO a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { investment: LOCKED_ID },
          { operation: 'update', originalDoc: { ...expense, investment: 7 } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses moving a transaction OFF a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { investment: 7 },
          { operation: 'update', originalDoc: { ...expense, investment: LOCKED_ID } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  // The one exception to the total lock: a faktura still has to be attachable to a settled
  // investment's transaction, because the scan arrives after the money stopped moving.
  // Every case below sends the WHOLE stored row with the patch merged over it, because that is what
  // Payload hands `beforeValidate` — a hand-built `{ invoice: … }` passes on any build, including the
  // one that refused every faktura in production.
  const locked = { ...expense, investment: LOCKED_ID, invoice: [3] }

  it('lets an invoice-only write through', async () => {
    await expect(
      validateTransfer(
        hookArgs({ ...locked, invoice: [3, 4] }, { operation: 'update', originalDoc: locked }),
      ),
    ).resolves.not.toThrow()
  })

  // Keyed on the VALUES that differ from the stored row — clearing every page is still invoice-only.
  it('lets an invoice removal through', async () => {
    await expect(
      validateTransfer(
        hookArgs({ ...locked, invoice: [] }, { operation: 'update', originalDoc: locked }),
      ),
    ).resolves.not.toThrow()
  })

  it('refuses a write that smuggles another field alongside the invoice', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { ...locked, invoice: [3, 4], amount: 999 },
          { operation: 'update', originalDoc: locked },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  // A row with no investment at all (OTHER, przelew międzykasowy) never consults the lock.
  it('lets an investment-less transfer through', async () => {
    await expect(
      validateTransfer(
        hookArgs({
          amount: 100,
          date: '2026-09-03',
          paymentMethod: 'CASH',
          type: 'OTHER',
          sourceRegister: 1,
          otherCategory: 1,
        }),
      ),
    ).resolves.not.toThrow()
  })
})
