import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload, PayloadRequest, Where } from 'payload'
import { perfStart } from '@/lib/perf'
import { deriveCategoryBreakdowns, deriveFinancials } from '@/lib/db/investment-financials'
import type {
  CategoryTypeSettledRowT,
  InvestmentFinancialsT,
  TypeSettledTotalT,
} from '@/types/investment-financials'
import type { PayoutByWorkerT, PayoutTransactionRowT } from '@/types/reference-data'
import { buildSqlConditions, isNoResultsSentinel } from '@/lib/db/where-to-sql'
import { getDb } from '@/lib/db/get-db'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'

// Re-exported so the existing importers of the derive functions keep resolving here.
export { deriveCategoryBreakdowns, deriveFinancials } from '@/lib/db/investment-financials'

// Parameterized `(type, …)` IN-list derived from the single DEPOSIT_TYPES source, so the
// deposit-vs-expense split isn't re-inlined as a literal in every balance query.
const depositTypesInList = sql`(${sql.join(
  DEPOSIT_TYPES.map((type) => sql`${type}`),
  sql.raw(', '),
)})`

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
          WHEN type IN ${depositTypesInList}
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
            WHEN type IN ${depositTypesInList}
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
        type::text AS type,
        (settled IS TRUE) AS settled,
        COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
      GROUP BY investment_id, type, (settled IS TRUE)
    `),
    db.execute(sql`
      SELECT investment_id, expense_category_id,
        type::text AS type,
        (settled IS TRUE) AS settled,
        COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
        AND expense_category_id IS NOT NULL
      GROUP BY investment_id, expense_category_id, type, (settled IS TRUE)
    `),
  ])

  // Group the raw (type, settled) sums per investment.
  const rowsByInvestment = new Map<number, TypeSettledTotalT[]>()
  for (const row of totalsResult.rows) {
    const invId = Number(row.investment_id)
    let list = rowsByInvestment.get(invId)
    if (!list) {
      list = []
      rowsByInvestment.set(invId, list)
    }
    list.push({
      type: row.type as string,
      settled: row.settled === true,
      total: Number(row.total),
    })
  }

  // Group the raw (category, type, settled) sums per investment.
  const categoryRowsByInvestment = new Map<number, CategoryTypeSettledRowT[]>()
  for (const row of categoryResult.rows) {
    const invId = Number(row.investment_id)
    let list = categoryRowsByInvestment.get(invId)
    if (!list) {
      list = []
      categoryRowsByInvestment.set(invId, list)
    }
    list.push({
      categoryId: Number(row.expense_category_id),
      type: row.type as string,
      settled: row.settled === true,
      total: Number(row.total),
    })
  }

  // One shared classifier for both paths: feed each investment's raw sums through
  // deriveFinancials + deriveCategoryBreakdowns. The listing renders the aggregate, but
  // computing settledCategoryCosts here keeps the two paths identical by construction.
  const map = new Map<number, InvestmentFinancialsT>()
  for (const [invId, rows] of rowsByInvestment) {
    const { categoryCosts, settledCategoryCosts } = deriveCategoryBreakdowns(
      categoryRowsByInvestment.get(invId) ?? [],
    )
    map.set(invId, deriveFinancials(rows, categoryCosts, settledCategoryCosts))
  }
  console.log(`[PERF] query.sumAllInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
  return map
}

/**
 * SUM amounts grouped by (expense_category_id, type, settled) for a filtered set.
 * Raw sums only — no business rule in SQL. Feed to deriveCategoryBreakdowns().
 */
export const sumCategoryByTypeSettled = async (
  payload: Payload,
  where: Where,
): Promise<CategoryTypeSettledRowT[]> => {
  if (isNoResultsSentinel(where)) return []

  const db = await getDb(payload)
  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
      SELECT expense_category_id,
        type::text AS type,
        (settled IS TRUE) AS settled,
        COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE cancelled IS NOT TRUE
        AND expense_category_id IS NOT NULL
        ${conditions}
      GROUP BY expense_category_id, type, (settled IS TRUE)
    `),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => ({
    categoryId: Number(row.expense_category_id),
    type: row.type as string,
    settled: row.settled === true,
    total: Number(row.total),
  }))
}

/**
 * Fetch the investment's deposit rows (cancelled excluded) with their etap tag. Deposit
 * count per investment is small, so we return raw rows and let sumZaliczkiByStage filter +
 * group — keeping the untagged-exclusion rule in one testable pure place.
 */
export const sumDepositRowsForInvestment = async (
  payload: Payload,
  investmentId: number,
): Promise<{ type: string; amount: number; kosztorysStage: number | null }[]> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT type::text AS type, amount, kosztorys_stage_id
    FROM transactions
    WHERE investment_id = ${investmentId}
      AND cancelled IS NOT TRUE
      AND type IN ${depositTypesInList}
  `)

  return result.rows.map((row) => ({
    type: row.type as string,
    amount: Number(row.amount),
    kosztorysStage: row.kosztorys_stage_id == null ? null : Number(row.kosztorys_stage_id),
  }))
}

/**
 * SUM realized PAYOUT amounts for ONE investment, grouped by worker. Mirrors sumAllWorkerBalances
 * but scoped to an investment and — critically — WITHOUT a `worker_id IS NOT NULL` guard: a null
 * worker is a real cash payout that must still count toward Σ zaliczek, else „Pozostało do wypłaty"
 * overstates the debt. Names are resolved at the page (kept off this query so it stays tagged on
 * transfers alone).
 */
export const sumPayoutsByWorkerForInvestment = async (
  payload: Payload,
  investmentId: number,
): Promise<PayoutByWorkerT[]> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT worker_id,
      COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'PAYOUT'
      AND investment_id = ${investmentId}
      AND cancelled IS NOT TRUE
    GROUP BY worker_id
  `)

  const rows = result.rows.map((row) => ({
    workerId: row.worker_id == null ? null : Number(row.worker_id),
    total: Number(row.total),
  }))
  console.log(
    `[PERF] query.sumPayoutsByWorkerForInvestment ${elapsed()}ms (${rows.length} workers)`,
  )
  return rows
}

/**
 * The individual realized PAYOUT rows for an investment — the un-summed twin of
 * `sumPayoutsByWorkerForInvestment`, so the subcontractor block can list each wypłata
 * (data · pracownik · opis · kwota), sortable, alongside the per-worker totals. Same filter
 * (PAYOUT, this investment, not cancelled), null worker kept. Names resolve at the page.
 */
export const getPayoutTransactionsForInvestment = async (
  payload: Payload,
  investmentId: number,
): Promise<PayoutTransactionRowT[]> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT worker_id, date, amount, description
    FROM transactions
    WHERE type = 'PAYOUT'
      AND investment_id = ${investmentId}
      AND cancelled IS NOT TRUE
    ORDER BY date DESC, id DESC
  `)

  const rows = result.rows.map((row) => ({
    workerId: row.worker_id == null ? null : Number(row.worker_id),
    date: String(row.date),
    amount: Number(row.amount),
    description: row.description == null ? null : String(row.description),
  }))
  console.log(
    `[PERF] query.getPayoutTransactionsForInvestment ${elapsed()}ms (${rows.length} rows)`,
  )
  return rows
}

export const sumFilteredByType = async (
  payload: Payload,
  where: Where,
): Promise<TypeSettledTotalT[]> => {
  if (isNoResultsSentinel(where)) {
    return []
  }

  const db = await getDb(payload)
  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
    SELECT
      type::text AS type,
      (settled IS TRUE) AS settled,
      COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE cancelled IS NOT TRUE
      ${conditions}
    GROUP BY type, (settled IS TRUE)
    ORDER BY total DESC
  `),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => ({
    type: row.type as string,
    settled: row.settled === true,
    total: Number(row.total),
  }))
}
