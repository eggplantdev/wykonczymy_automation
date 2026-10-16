import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { sumAllInvestmentFinancials, sumAllRegisterBalances } from '@/lib/db/sum-transfers'
import { getDb } from '@/lib/db/get-db'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { marginV2 } from '@/lib/kosztorys/margin-v2'
import { selectKosztorysClientTotals } from '@/lib/db/kosztorys-client-totals'
import { selectDepositPlaneSums } from '@/lib/db/deposit-plane-sums'
import {
  depositPairFromPlaneSums,
  NO_DEPOSIT_SUMS,
  type DepositPlaneSumsT,
} from '@/lib/kosztorys/deposit-planes'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import { NOTHING_DUE } from '@/lib/kosztorys/subcontractor-due'
import { financialsOnReading, readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { round2 } from '@/__tests__/helpers/money'

// It proves PRESERVATION, not correctness: a figure the app computes wrongly today is
// frozen exactly as wrongly.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const UPDATE = process.env.UPDATE_GOLDEN === '1'

const FIXTURE_PATH = join(process.cwd(), 'src/__tests__/fixtures/financial-golden-master.json')

type CategoryPairT = [categoryId: number, total: number]

const roundOrNull = (value: number | null) => (value === null ? null : round2(value))

type InvestmentSnapshotT = {
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalDiscount: number
  totalLoss: number
  totalBonus: number
  totalSettled: number
  balance: number
  margin: number
  /** `null` where an etap holds work with no rozliczenie. */
  marginV2: number | null
  /** an untagged wpłata sliding into the brutto bucket moves two of these and leaves their sum alone. */
  deposits: DepositPlaneSumsT
  depositsNet: number
  categoryCosts: CategoryPairT[]
  settledCategoryCosts: CategoryPairT[]
}

/** Investment NAMES are real client names — they stay out of the committed fixture and are
 *  re-read from the DB only to label a failure. */
type HashMapT = Record<string, string>

type SnapshotT = {
  fingerprint: {
    transactionCount: number
    kosztorysItemCount: number
    grossDepositsWithNet: number
  }
  inputHashes: { investments: HashMapT; registers: HashMapT }
  investments: Record<string, InvestmentSnapshotT>
  registers: Record<string, number>
}

const ZERO_FINANCIALS: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  materialsGrossBase: 0,
  materialsNetBilled: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalDiscount: 0,
  totalLoss: 0,
  totalBonus: 0,
  totalSettled: 0,
  materialsNetDiscount: 0,
  settledCategoryCosts: [],
  netCategoryCosts: [],
}

const toPairs = (costs: { categoryId: number; total: number }[]): CategoryPairT[] =>
  costs.map((c): CategoryPairT => [c.categoryId, round2(c.total)]).sort((a, b) => a[0] - b[0])

/** A register is hashed over the transactions on EITHER side of it, since both move its balance. */
async function readInputHashes(payload: Payload) {
  const db = await getDb(payload)
  const result = await db.execute(sql`
    WITH signed AS (
      SELECT
        id, investment_id, source_register_id, target_register_id,
        id || '|' || type || '|' || amount
          || '|' || COALESCE(net_amount::text, '')
          || '|' || COALESCE(vat_plane::text, '')
          || '|' || COALESCE(settled::text, '')
          || '|' || COALESCE(investment_id::text, '')
          || '|' || COALESCE(source_register_id::text, '')
          || '|' || COALESCE(target_register_id::text, '')
          || '|' || COALESCE(expense_category_id::text, '')
          || '|' || COALESCE(worker_id::text, '')
          || '|' || COALESCE(cancelled::text, '') AS sig
      FROM transactions
    ),
    scoped AS (
      SELECT 'investments' AS scope, investment_id AS key, id, sig FROM signed WHERE investment_id IS NOT NULL
      UNION ALL
      SELECT 'registers', source_register_id, id, sig FROM signed WHERE source_register_id IS NOT NULL
      UNION ALL
      SELECT 'registers', target_register_id, id, sig FROM signed WHERE target_register_id IS NOT NULL
    )
    SELECT scope, key, md5(string_agg(sig, ',' ORDER BY id)) AS hash
    FROM scoped GROUP BY scope, key
  `)

  const hashes: SnapshotT['inputHashes'] = { investments: {}, registers: {} }
  for (const row of result.rows) {
    hashes[String(row.scope) as keyof SnapshotT['inputHashes']][String(row.key)] = String(row.hash)
  }

  // Without them a kosztorys edit would read as code drift (the figure moved, the hash didn't).
  const kosztorys = await db.execute(sql`
    SELECT
      ki.investment_id AS key,
      count(*)::int AS item_count,
      coalesce(sum(sp.qty), 0)::text AS qty_done,
      md5(
        string_agg(
          -- A ROW, not concat_ws: concat_ws drops NULLs, so a mnożnik and a kwota of the same
          -- value would hash alike, and NULL is exactly what picks the stawka's źródło.
          ROW(
            ki.client_price, ki.discount_type, ki.discount_value,
            ki.w_tools_override_coeff, ki.w_tools_override_value,
            ki.own_tools_override_coeff, ki.own_tools_override_value
          )::text,
          -- NOT ORDER BY ki.id: the seeds insert items with Promise.all, so a re-seed hands the
          -- same rows different serial ids in a different order and this hash moves while nothing
          -- about the data did — the kosztorys axis then goes dark on a fixture nobody can keep
          -- fresh. Section + display order is what the seed actually fixes.
          ',' ORDER BY ki.section_id, ki.display_order, ki.id
        )
      ) AS items,
      (
        SELECT md5(
          string_agg(
            coalesce(ks.plane::text, '') || ':' || coalesce(
              -- A one-person split renders as the bare worker id, exactly as the single
              -- \`worker_id\` column did, so every etap migrated from it keeps its hash.
              (
                SELECT CASE
                  WHEN count(*) = 1 AND bool_and(ksw.takes_rest) THEN min(ksw.worker_id)::text
                  ELSE ks.split_mode::text || '=' || string_agg(
                    ROW(ksw.worker_id, ksw.value, ksw.takes_rest)::text, ';' ORDER BY ksw.worker_id
                  )
                END
                FROM kosztorys_stage_workers ksw
                WHERE ksw.stage_id = ks.id
                HAVING count(*) > 0
              ),
              ''
            ),
            ',' ORDER BY ks.id
          )
        )
        FROM kosztorys_stages ks
        WHERE ks.investment_id = ki.investment_id
      ) AS stages
    FROM kosztorys_items ki
    LEFT JOIN (
      SELECT item_id, sum(qty_done) AS qty FROM stage_progress GROUP BY item_id
    ) sp ON sp.item_id = ki.id
    GROUP BY ki.investment_id
  `)

  let kosztorysItemCount = 0
  for (const row of kosztorys.rows) {
    const key = String(row.key)
    kosztorysItemCount += Number(row.item_count)
    const sig = `k:${row.item_count}|${row.qty_done}|${row.items}|${row.stages ?? ''}`
    hashes.investments[key] = `${hashes.investments[key] ?? ''}/${sig}`
  }

  // `vat_rate` is absent on purpose — no frozen figure reads it.
  const settings = await db.execute(sql`
    SELECT
      id AS key,
      ROW(
        materials_net_rate, settlement_mode, w_tools_coeff, own_tools_coeff,
        global_discount_type, global_discount_value
      )::text AS sig
    FROM investments
  `)
  for (const row of settings.rows) {
    const key = String(row.key)
    hashes.investments[key] = `${hashes.investments[key] ?? ''}/s:${row.sig}`
  }

  const counted = await db.execute(sql`
    SELECT
      count(*)::int AS row_count,
      count(*) FILTER (
        WHERE type = 'INVESTOR_DEPOSIT' AND cancelled IS NOT TRUE
          AND vat_plane = 'GROSS' AND net_amount IS NOT NULL
      )::int AS gross_with_net
    FROM transactions
  `)
  return {
    hashes,
    transactionCount: Number(counted.rows[0].row_count),
    kosztorysItemCount,
    grossDepositsWithNet: Number(counted.rows[0].gross_with_net),
  }
}

async function buildSnapshot(payload: Payload): Promise<{
  snapshot: SnapshotT
  names: Map<string, string>
}> {
  const [inputs, investmentsPage, financialsMap, registerBalances] = await Promise.all([
    readInputHashes(payload),
    payload.find({
      collection: 'investments',
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    sumAllInvestmentFinancials(payload),
    sumAllRegisterBalances(payload),
  ])

  const db = await getDb(payload)
  const [clientTotalRows, subcontractorDueRows, depositPlaneSumRows] = await Promise.all([
    selectKosztorysClientTotals(db),
    selectKosztorysSubcontractorDue(db),
    selectDepositPlaneSums(db),
  ])
  const clientTotals = new Map(clientTotalRows.map((row) => [row.investmentId, row]))
  const subcontractorDue = new Map(subcontractorDueRows.map((row) => [row.investmentId, row]))
  const depositPlaneSums = new Map(
    depositPlaneSumRows.map(({ investmentId, ...sums }) => [investmentId, sums]),
  )

  const investments: Record<string, InvestmentSnapshotT> = {}
  const names = new Map<string, string>()
  for (const doc of investmentsPage.docs) {
    const id = Number(doc.id)
    names.set(String(id), String(doc.name))
    const financials = financialsMap.get(id) ?? ZERO_FINANCIALS
    const deposits = depositPlaneSums.get(id) ?? NO_DEPOSIT_SUMS
    investments[String(id)] = {
      totalMaterialCosts: round2(financials.totalMaterialCosts),
      totalIncome: round2(financials.totalIncome),
      totalLaborCosts: round2(financials.totalLaborCosts),
      totalPayouts: round2(financials.totalPayouts),
      totalDiscount: round2(financials.totalDiscount),
      totalLoss: round2(financials.totalLoss),
      totalBonus: round2(financials.totalBonus),
      totalSettled: round2(financials.totalSettled),
      balance: round2(calculateBalance(financials)),
      margin: round2(calculateMargin(financials)),
      marginV2: roundOrNull(
        marginV2(
          financialsOnReading(financials, readingFromKosztorys(clientTotals.get(id))),
          subcontractorDue.get(id) ?? NOTHING_DUE,
        ),
      ),
      deposits: {
        paidNet: round2(deposits.paidNet),
        paidGrossNet: round2(deposits.paidGrossNet),
        paidGross: round2(deposits.paidGross),
        paidNetCount: deposits.paidNetCount,
      },
      depositsNet: round2(depositPairFromPlaneSums(deposits).net),
      categoryCosts: toPairs(financials.categoryCosts),
      settledCategoryCosts: toPairs(financials.settledCategoryCosts),
    }
  }

  const mapToRecord = (map: Map<number, number>): Record<string, number> =>
    Object.fromEntries([...map].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), round2(v)]))

  return {
    snapshot: {
      fingerprint: {
        transactionCount: inputs.transactionCount,
        kosztorysItemCount: inputs.kosztorysItemCount,
        grossDepositsWithNet: inputs.grossDepositsWithNet,
      },
      inputHashes: inputs.hashes,
      investments,
      registers: mapToRecord(registerBalances),
    },
    names,
  }
}

/** The dataset floor, asserted in TWO places on purpose: as a test (a thin dataset makes
 *  every comparison trivially pass) and as a precondition on the REGENERATE path, which
 *  overwrites the only committed record of the pre-refactor figures. */
const DATASET_FLOOR = {
  investments: 50,
  registers: 10,
  transactions: 1000,
  kosztorysItems: 20,
  grossDepositsWithNet: 2,
}

function assertNonTrivial(snapshot: SnapshotT) {
  const counts = {
    investments: Object.keys(snapshot.investments).length,
    registers: Object.keys(snapshot.registers).length,
    transactions: snapshot.fingerprint.transactionCount,
    kosztorysItems: snapshot.fingerprint.kosztorysItemCount,
    grossDepositsWithNet: snapshot.fingerprint.grossDepositsWithNet,
  }
  for (const key of Object.keys(DATASET_FLOOR) as (keyof typeof DATASET_FLOOR)[]) {
    if (counts[key] <= DATASET_FLOOR[key]) {
      throw new Error(
        `db-test holds only ${counts[key]} ${key} (floor ${DATASET_FLOOR[key]}) — this is a ` +
          `thin or half-restored dataset. Run \`pnpm db:import:test\`, then ` +
          `\`pnpm seed:kosztorys:test\`, \`pnpm seed:deposits:test\` and ` +
          `\`pnpm seed:materials-net:test\`, before regenerating.`,
      )
    }
  }
}

describe.skipIf(!ENV_READY)('financial golden master — every figure, every investment (DB)', () => {
  let snapshot: SnapshotT | null = null
  let names = new Map<string, string>()
  let templateIds = new Set<string>()
  let setupError: unknown = null

  beforeAll(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })
      const built = await buildSnapshot(payload)
      snapshot = built.snapshot
      names = built.names
      const templates = await (
        await getDb(payload)
      ).execute(sql`
        SELECT id FROM investments WHERE status = 'szablon';
      `)
      templateIds = new Set(templates.rows.map((r) => String(r.id)))
      if (UPDATE) {
        assertNonTrivial(snapshot)
        writeFileSync(FIXTURE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
      }
    } catch (e) {
      setupError = e
    }
  })

  it('snapshot matches the frozen fixture, investment by investment', () => {
    if (setupError || !snapshot) {
      throw new Error(
        `golden master could not reach the DB — env is set, so this is a failure, not a skip. ` +
          `Cause: ${String(setupError)}`,
      )
    }
    if (UPDATE) {
      expect(existsSync(FIXTURE_PATH)).toBe(true)
      return
    }
    if (!existsSync(FIXTURE_PATH)) {
      throw new Error(
        `no fixture at ${FIXTURE_PATH} — generate it with \`pnpm test:golden:update\``,
      )
    }

    const expected: SnapshotT = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
    const actual = snapshot

    if (!expected.inputHashes) {
      throw new Error(
        `fixture at ${FIXTURE_PATH} predates per-entity input hashing — ` +
          `regenerate it with \`pnpm test:golden:update\``,
      )
    }

    const drift: string[] = []
    const dataMoved: string[] = []
    let investmentsSkipped = 0
    const label = (id: string) => `#${id} ${names.get(id) ?? '(unknown)'}`

    const inputsUnchanged = (scope: keyof SnapshotT['inputHashes'], id: string) =>
      (expected.inputHashes[scope][id] ?? '') === (actual.inputHashes[scope][id] ?? '')

    // The `total / 2` floor below counts entities and is blind to WHICH ones, so it cannot see an
    // axis going dark.
    const AXES = [
      {
        name: 'wpłata brutto',
        guards: '`deposits` and `depositsNet`',
        reseed: 'pnpm seed:deposits:test',
        carriedBy: (id: string) => (expected.investments[id]?.deposits.paidGross ?? 0) !== 0,
      },
      {
        name: 'kosztorys',
        guards: '`totalLaborCosts` and the v2 figures derived from it',
        reseed: 'pnpm seed:kosztorys:test',
        // Not a szablon: the DB integration specs create and edit szablony right before this leg
        // runs on pre-push.
        carriedBy: (id: string) =>
          !templateIds.has(id) && (expected.inputHashes.investments[id] ?? '').includes('/k:'),
      },
    ] as const

    const axisSkipped = new Map(AXES.map((axis) => [axis.name, [] as string[]]))
    const noteAxisSkip = (id: string) => {
      for (const axis of AXES) {
        if (axis.carriedBy(id)) axisSkipped.get(axis.name)!.push(label(id))
      }
    }

    for (const id of Object.keys(expected.investments)) {
      const now = actual.investments[id]
      if (!now) {
        dataMoved.push(`${label(id)} (gone)`)
        investmentsSkipped++
        noteAxisSkip(id)
        continue
      }
      if (!inputsUnchanged('investments', id)) {
        dataMoved.push(label(id))
        investmentsSkipped++
        noteAxisSkip(id)
        continue
      }
      const was = expected.investments[id]
      for (const key of Object.keys(was) as (keyof InvestmentSnapshotT)[]) {
        const a = JSON.stringify(was[key])
        const b = JSON.stringify(now[key])
        if (a !== b) drift.push(`${label(id)} · ${key}: expected ${a} got ${b}`)
      }
    }

    for (const [scope, wasMap, nowMap] of [
      ['registers', expected.registers, actual.registers],
    ] as const) {
      const singular = scope.slice(0, -1)
      for (const key of Object.keys(wasMap)) {
        if (!(key in nowMap)) {
          dataMoved.push(`${singular} #${key} (gone)`)
          continue
        }
        if (!inputsUnchanged(scope, key)) {
          dataMoved.push(`${singular} #${key}`)
          continue
        }
        if (wasMap[key] !== nowMap[key]) {
          drift.push(`${singular} #${key} · balance: expected ${wasMap[key]} got ${nowMap[key]}`)
        }
      }
    }

    if (dataMoved.length > 0) {
      console.warn(
        `[golden master] ${dataMoved.length} ${dataMoved.length === 1 ? 'entity' : 'entities'} skipped — their transactions changed in prod ` +
          `since the fixture was taken. Refresh at some point with \`pnpm test:golden:update\`.\n  ` +
          dataMoved.slice(0, 10).join('\n  ') +
          (dataMoved.length > 10 ? `\n  …and ${dataMoved.length - 10} more` : ''),
      )
    }

    const total = Object.keys(expected.investments).length
    const comparable = total - investmentsSkipped
    if (comparable < total / 2) {
      throw new Error(
        `only ${comparable} of ${total} fixture investments still ` +
          `match their transactions — the fixture is too stale to guard anything. ` +
          `Regenerate with \`pnpm test:golden:update\` and review the diff.`,
      )
    }

    for (const axis of AXES) {
      const skipped = axisSkipped.get(axis.name)!
      if (skipped.length === 0) continue
      throw new Error(
        `${skipped.length} of the fixture's ${axis.name} investments fell out of the compared set, ` +
          `so ${axis.guards} are guarded on nobody:\n  ` +
          skipped.join('\n  ') +
          `\nIf their rows really moved, re-seed with \`${axis.reseed}\` (the seeds write fixed ` +
          `ids on purpose) and regenerate with \`pnpm test:golden:update\`.`,
      )
    }

    expect(drift).toEqual([])
  })

  it('covers a non-trivial slice of the real dataset', () => {
    const built = snapshot
    if (!built) throw new Error('snapshot not built')
    assertNonTrivial(built)
  })
})
