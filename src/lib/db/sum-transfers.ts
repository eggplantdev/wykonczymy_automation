import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload, PayloadRequest, Where } from 'payload'
import { perfStart } from '@/lib/perf'

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
 * EMPLOYEE_EXPENSE has source_register_id = NULL so is automatically excluded.
 * REGISTER_TRANSFER: subtracts from source (source_register_id) via main query,
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
          WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT', 'EMPLOYEE_EXPENSE')
            THEN amount
          ELSE -amount
        END
      ), 0)
      + COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE target_register_id = ${registerId}
          AND type = 'REGISTER_TRANSFER'
          AND cancelled IS NOT TRUE
      ), 0)
      AS balance
    FROM transactions
    WHERE source_register_id = ${registerId}
      AND cancelled IS NOT TRUE
  `)

  return Number(result.rows[0].balance)
}

/**
 * SUM costs for an investment using SQL aggregation.
 * INVESTMENT_EXPENSE, EMPLOYEE_EXPENSE, and LABOR_COST types count.
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
      AND type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE', 'LABOR_COST')
      AND cancelled IS NOT TRUE
  `)

  return Number(result.rows[0].total)
}

/**
 * SUM income for an investment using SQL aggregation.
 * Only INVESTOR_DEPOSIT types count.
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
      AND type IN ('INVESTOR_DEPOSIT')
      AND cancelled IS NOT TRUE
  `)

  return Number(result.rows[0].total)
}

/**
 * SUM balances for ALL cash registers in one query (GROUP BY).
 * Returns a Map<registerId, balance>.
 */
export const sumAllRegisterBalances = async (payload: Payload): Promise<Map<number, number>> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    WITH source_balances AS (
      SELECT source_register_id AS register_id,
        COALESCE(SUM(
          CASE
            WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT', 'EMPLOYEE_EXPENSE')
              THEN amount
            ELSE -amount
          END
        ), 0) AS balance
      FROM transactions
      WHERE source_register_id IS NOT NULL
        AND cancelled IS NOT TRUE
      GROUP BY source_register_id
    ),
    target_balances AS (
      SELECT target_register_id AS register_id,
        COALESCE(SUM(amount), 0) AS balance
      FROM transactions
      WHERE target_register_id IS NOT NULL
        AND type = 'REGISTER_TRANSFER'
        AND cancelled IS NOT TRUE
      GROUP BY target_register_id
    )
    SELECT
      COALESCE(s.register_id, t.register_id) AS register_id,
      COALESCE(s.balance, 0) + COALESCE(t.balance, 0) AS balance
    FROM source_balances s
    FULL OUTER JOIN target_balances t ON s.register_id = t.register_id
  `)

  const map = new Map<number, number>()
  for (const row of result.rows) {
    map.set(Number(row.register_id), Number(row.balance))
  }
  console.log(`[PERF] query.sumAllRegisterBalances ${elapsed()}ms (${map.size} registers)`)
  return map
}

export type InvestmentFinancialsT = {
  totalCosts: number
  totalIncome: number
  totalLaborCosts: number
}

/**
 * SUM costs and income for ALL investments in one query (GROUP BY).
 * Returns a Map<investmentId, { totalCosts, totalIncome }>.
 */
export const sumAllInvestmentFinancials = async (
  payload: Payload,
): Promise<Map<number, InvestmentFinancialsT>> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT investment_id,
      COALESCE(SUM(CASE WHEN type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE') THEN amount ELSE 0 END), 0) AS total_costs,
      COALESCE(SUM(CASE WHEN type IN ('INVESTOR_DEPOSIT') THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'LABOR_COST' THEN amount ELSE 0 END), 0) AS total_labor_costs
    FROM transactions
    WHERE investment_id IS NOT NULL
      AND cancelled IS NOT TRUE
    GROUP BY investment_id
  `)

  const map = new Map<number, InvestmentFinancialsT>()
  for (const row of result.rows) {
    map.set(Number(row.investment_id), {
      totalCosts: Number(row.total_costs),
      totalIncome: Number(row.total_income),
      totalLaborCosts: Number(row.total_labor_costs),
    })
  }
  console.log(`[PERF] query.sumAllInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
  return map
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
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT worker_id,
      COALESCE(SUM(
        CASE WHEN type = 'ACCOUNT_FUNDING' THEN amount ELSE -amount END
      ), 0) AS saldo
    FROM transactions
    WHERE worker_id IS NOT NULL
      AND type IN ('ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE')
      AND cancelled IS NOT TRUE
    GROUP BY worker_id
  `)

  const map = new Map<number, number>()
  for (const row of result.rows) {
    map.set(Number(row.worker_id), Number(row.saldo))
  }
  console.log(`[PERF] query.sumAllWorkerSaldos ${elapsed()}ms (${map.size} workers)`)
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
        AND cancelled IS NOT TRUE
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
      AND cancelled IS NOT TRUE
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
      AND cancelled IS NOT TRUE
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

/** Detects the NO_RESULTS sentinel ({ id: { equals: -1 } }) in a Where clause. */
export const isNoResultsSentinel = (where: Where): boolean => {
  const id = where.id as Record<string, unknown> | undefined
  return id !== undefined && 'equals' in id && id.equals === -1
}

/**
 * SUM costs, income, and labor costs for transactions matching a Payload Where clause.
 * Translates the Where clause to raw SQL conditions.
 * Returns aggregate totals — no GROUP BY, single result row.
 */
export const sumFilteredFinancials = async (
  payload: Payload,
  where: Where,
): Promise<InvestmentFinancialsT> => {
  if (isNoResultsSentinel(where)) {
    return { totalCosts: 0, totalIncome: 0, totalLaborCosts: 0 }
  }

  const elapsed = perfStart()
  const db = await getDb(payload)

  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE') THEN amount ELSE 0 END), 0) AS total_costs,
      COALESCE(SUM(CASE WHEN type IN ('INVESTOR_DEPOSIT') THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'LABOR_COST' THEN amount ELSE 0 END), 0) AS total_labor_costs
    FROM transactions
    WHERE cancelled IS NOT TRUE
      ${conditions}
  `),
  )

  console.log(`[PERF] query.sumFilteredFinancials ${elapsed()}ms`)

  return {
    totalCosts: Number(result.rows[0].total_costs),
    totalIncome: Number(result.rows[0].total_income),
    totalLaborCosts: Number(result.rows[0].total_labor_costs),
  }
}

/**
 * Returns SUM(amount) grouped by transaction type.
 * Handles NO_RESULTS sentinel.
 * Use deriveFinancials() and deriveCostBreakdown() to extract aggregates.
 */
export type TypeTotalT = { type: string; total: number }

export type CostBreakdownT = {
  investmentExpenses: number
  employeeExpenses: number
  laborCosts: number
}

/** Derive financials (costs/income/labor) from type distribution. */
export function deriveFinancials(byType: readonly TypeTotalT[]): InvestmentFinancialsT {
  const totalByType = (transferType: string) =>
    byType.find((row) => row.type === transferType)?.total ?? 0
  return {
    totalCosts: totalByType('INVESTMENT_EXPENSE') + totalByType('EMPLOYEE_EXPENSE'),
    totalIncome: totalByType('INVESTOR_DEPOSIT'),
    totalLaborCosts: totalByType('LABOR_COST'),
  }
}

/** Derive cost breakdown from type distribution. */
export function deriveCostBreakdown(byType: readonly TypeTotalT[]): CostBreakdownT {
  const totalByType = (transferType: string) =>
    byType.find((row) => row.type === transferType)?.total ?? 0
  return {
    investmentExpenses: totalByType('INVESTMENT_EXPENSE'),
    employeeExpenses: totalByType('EMPLOYEE_EXPENSE'),
    laborCosts: totalByType('LABOR_COST'),
  }
}

export const sumFilteredByType = async (payload: Payload, where: Where): Promise<TypeTotalT[]> => {
  if (isNoResultsSentinel(where)) {
    return []
  }

  const db = await getDb(payload)
  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
    SELECT type, COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE cancelled IS NOT TRUE
      ${conditions}
    GROUP BY type
    ORDER BY total DESC
  `),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => ({
    type: row.type as string,
    total: Number(row.total),
  }))
}

// ── Where-to-SQL translation ─────────────────────────────────────────

const FIELD_TO_COLUMN: Record<string, string> = {
  type: 'type',
  sourceRegister: 'source_register_id',
  targetRegister: 'target_register_id',
  investment: 'investment_id',
  worker: 'worker_id',
  createdBy: 'created_by_id',
  otherCategory: 'other_category_id',
  paymentMethod: 'payment_method',
  date: 'date',
  cancelled: 'cancelled',
}

/**
 * Translates a flat Payload Where object to SQL AND clauses.
 * Only handles the operators used by buildTransferFilters():
 *   { field: { equals: value } }
 *   { field: { in: values[] } }
 *   { field: { greater_than_equal: value } }
 *   { field: { less_than_equal: value } }
 *
 * All values come from buildTransferFilters() which validates against known enums
 * and parses numeric IDs. escapeValue provides SQL injection protection as a second layer.
 */
function buildSqlConditions(where: Where): string {
  const clauses: string[] = []

  for (const [field, condition] of Object.entries(where)) {
    if (field === 'id') continue // skip impossible-condition sentinel
    const column = FIELD_TO_COLUMN[field]
    if (!column || typeof condition !== 'object' || condition === null) continue

    const cond = condition as Record<string, unknown>

    if ('equals' in cond) {
      clauses.push(`AND ${column} = ${escapeValue(cond.equals)}`)
    }
    if ('in' in cond && Array.isArray(cond.in)) {
      const vals = cond.in.map(escapeValue).join(', ')
      clauses.push(`AND ${column} IN (${vals})`)
    }
    if ('greater_than_equal' in cond) {
      clauses.push(`AND ${column} >= ${escapeValue(cond.greater_than_equal)}`)
    }
    if ('less_than_equal' in cond) {
      clauses.push(`AND ${column} <= ${escapeValue(cond.less_than_equal)}`)
    }
  }

  return clauses.join('\n      ')
}

function escapeValue(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  return 'NULL'
}
