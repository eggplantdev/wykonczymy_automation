import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload, PayloadRequest } from 'payload'

export type DateRangeT = { start: string; end: string }

/**
 * Returns the transaction-scoped Drizzle instance when inside a hook
 * (where `req` carries a `transactionID`), or the default instance otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDb = async (payload: Payload, req?: PayloadRequest): Promise<any> => {
  const adapter = payload.db as unknown as Record<string, unknown>
  const txId = req?.transactionID ? await req.transactionID : undefined
  const sessions = adapter.sessions as Record<string, { db?: unknown }> | undefined

  if (txId && sessions?.[txId]?.db) return sessions[txId].db
  return adapter.drizzle
}

/**
 * SUM balance for a cash register using SQL aggregation.
 * Deposit types add, expense types subtract.
 * EMPLOYEE_EXPENSE has cash_register_id = NULL so is automatically excluded.
 * REGISTER_TRANSFER: subtracts from source (cash_register_id) via main query,
 * adds to target (target_register_id) via subquery.
 */
export const sumRegisterBalance = async (
  payload: Payload,
  registerId: number,
  req?: PayloadRequest,
): Promise<number> => {
  const db = await getDb(payload, req)

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN type IN ('INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT')
            THEN amount
          ELSE -amount
        END
      ), 0)
      + COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE target_register_id = ${registerId}
          AND type = 'REGISTER_TRANSFER'
      ), 0)
      AS balance
    FROM transactions
    WHERE cash_register_id = ${registerId}
  `)

  return Number(result.rows[0].balance)
}

/**
 * SUM costs for an investment using SQL aggregation.
 * Only INVESTMENT_EXPENSE and EMPLOYEE_EXPENSE types count.
 */
export const sumInvestmentCosts = async (
  payload: Payload,
  investmentId: number,
  req?: PayloadRequest,
): Promise<number> => {
  const db = await getDb(payload, req)

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE investment_id = ${investmentId}
      AND type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
  `)

  return Number(result.rows[0].total)
}

/**
 * SUM income for an investment using SQL aggregation.
 * Only INVESTOR_DEPOSIT and STAGE_SETTLEMENT types count.
 */
export const sumInvestmentIncome = async (
  payload: Payload,
  investmentId: number,
  req?: PayloadRequest,
): Promise<number> => {
  const db = await getDb(payload, req)

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE investment_id = ${investmentId}
      AND type IN ('INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT')
  `)

  return Number(result.rows[0].total)
}

/**
 * SUM employee saldo using SQL aggregation.
 * ACCOUNT_FUNDINGs add to saldo, EMPLOYEE_EXPENSEs subtract.
 * Optional date range filters by the `date` column.
 */
/**
 * SUM saldo for ALL workers in a single query, grouped by worker_id.
 * Returns a Map<workerId, saldo>.
 */
export const sumAllWorkerSaldos = async (payload: Payload): Promise<Map<number, number>> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT worker_id,
      COALESCE(SUM(
        CASE WHEN type = 'ACCOUNT_FUNDING' THEN amount ELSE -amount END
      ), 0) AS saldo
    FROM transactions
    WHERE worker_id IS NOT NULL
      AND type IN ('ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE')
    GROUP BY worker_id
  `)

  const map = new Map<number, number>()
  for (const row of result.rows) {
    map.set(Number(row.worker_id), Number(row.saldo))
  }
  return map
}

export const sumEmployeeSaldo = async (
  payload: Payload,
  workerId: number,
  dateRange?: DateRangeT,
): Promise<number> => {
  const db = await getDb(payload)

  if (dateRange) {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(
        CASE WHEN type = 'ACCOUNT_FUNDING' THEN amount ELSE -amount END
      ), 0) AS saldo
      FROM transactions
      WHERE worker_id = ${workerId}
        AND type IN ('ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE')
        AND date >= ${dateRange.start}
        AND date <= ${dateRange.end}
    `)
    return Number(result.rows[0].saldo)
  }

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE WHEN type = 'ACCOUNT_FUNDING' THEN amount ELSE -amount END
    ), 0) AS saldo
    FROM transactions
    WHERE worker_id = ${workerId}
      AND type IN ('ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE')
  `)

  return Number(result.rows[0].saldo)
}

export type WorkerPeriodBreakdownT = {
  totalAdvances: number
  totalExpenses: number
  periodSaldo: number
}

/**
 * Returns advances, expenses, and net saldo for a worker in a date range.
 * Single SQL query with CASE WHEN grouping.
 */
export const sumWorkerPeriodBreakdown = async (
  payload: Payload,
  workerId: number,
  dateRange: DateRangeT,
): Promise<WorkerPeriodBreakdownT> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ACCOUNT_FUNDING' THEN amount ELSE 0 END), 0) AS advances,
      COALESCE(SUM(CASE WHEN type = 'EMPLOYEE_EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
    FROM transactions
    WHERE worker_id = ${workerId}
      AND type IN ('ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE')
      AND date >= ${dateRange.start}
      AND date <= ${dateRange.end}
  `)

  const advances = Number(result.rows[0].advances)
  const expenses = Number(result.rows[0].expenses)

  return {
    totalAdvances: advances,
    totalExpenses: expenses,
    periodSaldo: advances - expenses,
  }
}
