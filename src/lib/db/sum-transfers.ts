import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload, PayloadRequest, Where } from 'payload'
import { perfStart } from '@/lib/perf'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'

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
          WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT')
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
            WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT')
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

/**
 * SUM payout amounts for ALL workers in one query (GROUP BY).
 * Returns a Map<workerId, totalPayouts>.
 */
export const sumAllWorkerBalances = async (payload: Payload): Promise<Map<number, number>> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT worker_id,
      COALESCE(SUM(amount), 0) AS balance
    FROM transactions
    WHERE worker_id IS NOT NULL
      AND type = 'PAYOUT'
      AND cancelled IS NOT TRUE
    GROUP BY worker_id
  `)

  const map = new Map<number, number>()
  for (const row of result.rows) {
    map.set(Number(row.worker_id), Number(row.balance))
  }
  console.log(`[PERF] query.sumAllWorkerBalances ${elapsed()}ms (${map.size} workers)`)
  return map
}

export type CategoryCostT = {
  categoryId: number
  total: number
}

export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  totalMaterialCosts: number
  totalCorrections: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
}

/**
 * SUM costs and income for ALL investments in one query (GROUP BY).
 * Returns a Map<investmentId, InvestmentFinancialsT>.
 */
export const sumAllInvestmentFinancials = async (
  payload: Payload,
): Promise<Map<number, InvestmentFinancialsT>> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const [totalsResult, categoryResult] = await Promise.all([
    db.execute(sql`
      SELECT investment_id,
        COALESCE(SUM(CASE WHEN type IN ('INVESTMENT_EXPENSE', 'CORRECTION') THEN amount ELSE 0 END), 0) AS total_costs,
        COALESCE(SUM(CASE WHEN type = 'CORRECTION' THEN amount ELSE 0 END), 0) AS total_corrections,
        COALESCE(SUM(CASE WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT') THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'LABOR_COST' THEN amount ELSE 0 END), 0) AS total_labor_costs,
        COALESCE(SUM(CASE WHEN type = 'PAYOUT' THEN amount ELSE 0 END), 0) AS total_payouts
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
      GROUP BY investment_id
    `),
    db.execute(sql`
      SELECT investment_id, expense_category_id,
        COALESCE(SUM(amount), 0) AS category_total
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
        AND type IN ('INVESTMENT_EXPENSE', 'CORRECTION')
        AND expense_category_id IS NOT NULL
      GROUP BY investment_id, expense_category_id
    `),
  ])

  // Build category costs per investment
  const categoryMap = new Map<number, CategoryCostT[]>()
  for (const row of categoryResult.rows) {
    const invId = Number(row.investment_id)
    if (!categoryMap.has(invId)) categoryMap.set(invId, [])
    categoryMap.get(invId)!.push({
      categoryId: Number(row.expense_category_id),
      total: Number(row.category_total),
    })
  }

  const map = new Map<number, InvestmentFinancialsT>()
  for (const row of totalsResult.rows) {
    const invId = Number(row.investment_id)
    map.set(invId, {
      categoryCosts: categoryMap.get(invId) ?? [],
      totalMaterialCosts: Number(row.total_costs),
      totalCorrections: Number(row.total_corrections),
      totalIncome: Number(row.total_income),
      totalLaborCosts: Number(row.total_labor_costs),
      totalPayouts: Number(row.total_payouts),
    })
  }
  console.log(`[PERF] query.sumAllInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
  return map
}

/**
 * SUM expense amounts grouped by expense_category_id for a filtered set of transactions.
 * Returns CategoryCostT[] for use in stat cards.
 */
export const sumCategoryBreakdown = async (
  payload: Payload,
  where: Where,
): Promise<CategoryCostT[]> => {
  if (isNoResultsSentinel(where)) return []

  const db = await getDb(payload)
  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
      SELECT expense_category_id, COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE cancelled IS NOT TRUE
        AND type IN ('INVESTMENT_EXPENSE', 'CORRECTION')
        AND expense_category_id IS NOT NULL
        ${conditions}
      GROUP BY expense_category_id
    `),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => ({
    categoryId: Number(row.expense_category_id),
    total: Number(row.total),
  }))
}

/** Detects the NO_RESULTS sentinel ({ id: { equals: -1 } }) in a Where clause. */
export const isNoResultsSentinel = (where: Where): boolean => {
  const id = where.id as Record<string, unknown> | undefined
  return id !== undefined && 'equals' in id && id.equals === -1
}

/**
 * Returns SUM(amount) grouped by transaction type.
 * Handles NO_RESULTS sentinel.
 * Use deriveFinancials() and deriveCostBreakdown() to extract aggregates.
 */
export type TypeTotalT = { type: string; total: number }

export type CostBreakdownT = {
  investmentExpenses: number
  laborCosts: number
}

const totalByType = (byType: TypeTotalT[], transferType: string): number =>
  byType.find((row) => row.type === transferType)?.total ?? 0

/** Derive financials (costs/income/labor) from type distribution. */
export function deriveFinancials(
  byType: TypeTotalT[],
  categoryCosts: CategoryCostT[] = [],
): InvestmentFinancialsT {
  return {
    categoryCosts,
    totalMaterialCosts:
      totalByType(byType, 'INVESTMENT_EXPENSE') + totalByType(byType, 'CORRECTION'),
    totalCorrections: totalByType(byType, 'CORRECTION'),
    totalIncome:
      totalByType(byType, 'INVESTOR_DEPOSIT') +
      totalByType(byType, 'COMPANY_FUNDING') +
      totalByType(byType, 'OTHER_DEPOSIT'),
    totalLaborCosts: totalByType(byType, 'LABOR_COST'),
    totalPayouts: totalByType(byType, 'PAYOUT'),
  }
}

/** Derive cost breakdown from type distribution. */
export function deriveCostBreakdown(byType: TypeTotalT[]): CostBreakdownT {
  return {
    investmentExpenses:
      totalByType(byType, 'INVESTMENT_EXPENSE') + totalByType(byType, 'CORRECTION'),
    laborCosts: totalByType(byType, 'LABOR_COST'),
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
  createdBy: 'created_by_id',
  expenseCategory: 'expense_category_id',
  otherCategory: 'other_category_id',
  worker: 'worker_id',
  paymentMethod: 'payment_method',
  date: 'date',
  cancelled: 'cancelled',
  amount: 'amount',
}

/**
 * Translates a flat Payload Where object to SQL AND clauses.
 * Only handles the operators used by buildTransferFilters():
 *   { field: { equals: value } }
 *   { field: { not_equals: value } }
 *   { field: { in: values[] } }
 *   { field: { not_in: values[] } }
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

    // Handle OR conditions (e.g. sourceRegister OR targetRegister)
    if (field === 'or' && Array.isArray(condition)) {
      const orParts = condition.map((sub: Where) => buildFieldCondition(sub)).filter(Boolean)
      if (orParts.length > 0) {
        clauses.push(`AND (${orParts.join(' OR ')})`)
      }
      continue
    }

    const part = buildFieldCondition({ [field]: condition })
    if (part) clauses.push(`AND ${part}`)
  }

  return clauses.join('\n      ')
}

/** Builds a single-field condition string (without AND prefix). Only handles the first matched field. */
function buildFieldCondition(where: Where): string | null {
  for (const [field, condition] of Object.entries(where)) {
    const column = FIELD_TO_COLUMN[field]
    if (!column || typeof condition !== 'object' || condition === null) continue

    const cond = condition as Record<string, unknown>
    const parts: string[] = []

    if ('equals' in cond) {
      parts.push(`${column} = ${escapeValue(cond.equals)}`)
    }
    if ('not_equals' in cond) {
      parts.push(`${column} != ${escapeValue(cond.not_equals)}`)
    }
    if ('in' in cond && Array.isArray(cond.in)) {
      const vals = cond.in.map(escapeValue).join(', ')
      parts.push(`${column} IN (${vals})`)
    }
    if ('not_in' in cond && Array.isArray(cond.not_in)) {
      const vals = cond.not_in.map(escapeValue).join(', ')
      parts.push(`${column} NOT IN (${vals})`)
    }
    if ('greater_than_equal' in cond) {
      parts.push(`${column} >= ${escapeValue(cond.greater_than_equal)}`)
    }
    if ('less_than_equal' in cond) {
      parts.push(`${column} <= ${escapeValue(cond.less_than_equal)}`)
    }
    // Prefix match on numeric columns (e.g. amount): cast to text, then LIKE '15%'
    // Callers must pre-validate values — this path uses sql.raw(), not parameterized queries
    if ('like' in cond) {
      parts.push(`${column}::text LIKE ${escapeValue(cond.like)} || '%'`)
    }

    if (parts.length > 0) return parts.join(' AND ')
  }
  return null
}

function escapeValue(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  return 'NULL'
}
