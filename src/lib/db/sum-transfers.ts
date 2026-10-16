import { sql } from '@payloadcms/db-postgres'
import { sqlList } from '@/lib/db/sql-list'
import type { Payload, PayloadRequest, Where } from 'payload'
import { perfStart } from '@/lib/perf'
import { deriveCategoryBreakdowns, deriveFinancials } from '@/lib/db/investment-financials'
import type {
  CategoryTypeSettledRowT,
  InvestmentFinancialsT,
  TypeSettledTotalT,
} from '@/types/investment-financials'
import { buildSqlConditions, isNoResultsSentinel } from '@/lib/db/where-to-sql'
import { getDb } from '@/lib/db/get-db'
import { DEPOSIT_TYPES, type TransferTypeT } from '@/lib/constants/transfers'
import { SETTLEMENT_MODE_DEFAULT, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

const depositTypesInList = sql`(${sqlList(DEPOSIT_TYPES)})`

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

export const sumAllInvestmentFinancials = async (
  payload: Payload,
): Promise<Map<number, InvestmentFinancialsT>> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  // The sums stay in Postgres numeric rather than being re-added in JS, which would drift by float
  // error.
  const [sumsResult, investmentsResult] = await Promise.all([
    db.execute(sql`
      SELECT investment_id, expense_category_id,
        GROUPING(expense_category_id) AS is_total,
        type::text AS type,
        (settled IS TRUE) AS settled,
        COALESCE(SUM(amount), 0) AS total,
        COALESCE(SUM(net_amount), 0) AS net_total
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
      GROUP BY GROUPING SETS (
        (investment_id, type, (settled IS TRUE)),
        (investment_id, expense_category_id, type, (settled IS TRUE))
      )
    `),
    // The materiały netto concession is per investment, so the listing's Marża can only be as
    // correct as the detail page's if the rate and its settlement-mode gate travel with the sums.
    db.execute(sql`
      SELECT id, materials_net_rate::float8, settlement_mode::text
      FROM investments
    `),
  ])

  const pricingByInvestment = new Map<number, { rate: number | null; mode: SettlementModeT }>()
  for (const row of investmentsResult.rows) {
    pricingByInvestment.set(Number(row.id), {
      rate: row.materials_net_rate == null ? null : Number(row.materials_net_rate),
      mode: (row.settlement_mode as SettlementModeT) ?? SETTLEMENT_MODE_DEFAULT,
    })
  }

  const rowsByInvestment = new Map<number, TypeSettledTotalT[]>()
  const categoryRowsByInvestment = new Map<number, CategoryTypeSettledRowT[]>()
  for (const row of sumsResult.rows) {
    const invId = Number(row.investment_id)
    const sums = {
      type: row.type as string,
      settled: row.settled === true,
      total: Number(row.total),
      netTotal: Number(row.net_total ?? 0),
    }
    if (Number(row.is_total) === 1) {
      pushTo(rowsByInvestment, invId, sums)
    } else if (row.expense_category_id != null) {
      pushTo(categoryRowsByInvestment, invId, {
        categoryId: Number(row.expense_category_id),
        ...sums,
      })
    }
  }

  const map = new Map<number, InvestmentFinancialsT>()
  for (const [invId, rows] of rowsByInvestment) {
    const { categoryCosts, settledCategoryCosts, netCategoryCosts } = deriveCategoryBreakdowns(
      categoryRowsByInvestment.get(invId) ?? [],
    )
    const pricing = pricingByInvestment.get(invId)
    map.set(
      invId,
      deriveFinancials(
        rows,
        categoryCosts,
        settledCategoryCosts,
        pricing?.rate ?? null,
        pricing?.mode ?? SETTLEMENT_MODE_DEFAULT,
        netCategoryCosts,
      ),
    )
  }
  console.log(`[PERF] query.sumAllInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
  return map
}

function pushTo<T>(map: Map<number, T[]>, key: number, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

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
        COALESCE(SUM(amount), 0) AS total,
        COALESCE(SUM(net_amount), 0) AS net_total
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
    netTotal: Number(row.net_total ?? 0),
  }))
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
      COALESCE(SUM(amount), 0) AS total,
      COALESCE(SUM(net_amount), 0) AS net_total
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
    netTotal: Number(row.net_total ?? 0),
  }))
}

export type TransferFacetsT = { investmentIds: number[]; types: TransferTypeT[] }

export const listTransferFacets = async (
  payload: Payload,
  where: Where,
): Promise<TransferFacetsT> => {
  if (isNoResultsSentinel(where)) return { investmentIds: [], types: [] }

  const db = await getDb(payload)
  const result = await db.execute(
    sql.raw(`
      SELECT
        COALESCE(ARRAY_AGG(DISTINCT investment_id) FILTER (WHERE investment_id IS NOT NULL), '{}')
          AS investment_ids,
        COALESCE(ARRAY_AGG(DISTINCT type::text), '{}') AS types
      FROM transactions
      WHERE cancelled IS NOT TRUE
        AND type <> 'CANCELLATION'
        ${buildSqlConditions(where)}
    `),
  )

  const row = result.rows[0]
  return {
    investmentIds: (row.investment_ids as unknown[]).map(Number),
    types: row.types as TransferTypeT[],
  }
}
