import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumAllRegisterBalances,
  sumAllWorkerBalances,
} from '@/lib/db/sum-transfers'
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
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import { NOTHING_DUE } from '@/lib/kosztorys/subcontractor-due'
import { financialsOnReading, readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { round2 } from '@/__tests__/helpers/money'

// GOLDEN MASTER (EX-573 phase 0b) — every displayed figure, for every investment, frozen
// against the real production dataset restored into the 5435 db-test container.
//
// This is NOT a prod-vs-local comparison. No test may open a connection to Neon
// (see AGENTS.md); production figures enter this suite as DATA, via the
// db:dump → db:import:test restore. And the risk being guarded is not "environments
// disagree" — it is "the refactor moved a number", which before-vs-after on one real
// dataset answers directly.
//
// It proves PRESERVATION, not correctness: a figure the app computes wrongly today is
// frozen exactly as wrongly (EX-574 is such a case, deliberately out of scope here).
//
//   run:        pnpm test:parity
//   regenerate: pnpm test:golden:update      (after a db:import:test refresh)
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const UPDATE = process.env.UPDATE_GOLDEN === '1'

const FIXTURE_PATH = join(process.cwd(), 'src/__tests__/fixtures/financial-golden-master.json')

type CategoryPairT = [categoryId: number, total: number]

// `null` is a value the withheld margin carries on purpose, so it must survive the rounding that
// every other figure goes through rather than collapsing to 0.
const roundOrNull = (value: number | null) => (value === null ? null : round2(value))

type InvestmentSnapshotT = {
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalDiscount: number
  totalLoss: number
  totalSettled: number
  balance: number
  margin: number
  /** The EX-649 reading, and the only field here that is NOT on the transactions plane: robocizna
   *  and rabat come from the kosztorys and the crew from its etapy, which is what the listing shows.
   *  `null` where an etap holds work with no rozliczenie. */
  marginV2: number | null
  /** The wpłaty bucketed by VAT plane, straight off the SQL fold the listing reads. Frozen as raw
   *  sums rather than one total because that is where a bucketing regression shows: an untagged
   *  wpłata sliding into the brutto bucket moves two of these and leaves their sum alone. */
  deposits: DepositPlaneSumsT
  /** Σ wpłat netto — the buckets folded by `depositPairFromPlaneSums`, which is what the settlement
   *  actually subtracts. Frozen beside the buckets so a regression in the fold shows even where the
   *  buckets themselves are untouched. */
  depositsNet: number
  categoryCosts: CategoryPairT[]
  settledCategoryCosts: CategoryPairT[]
}

/** What gets written to disk. Investment NAMES are real client names — they stay out of
 *  the committed fixture and are re-read from the DB only to label a failure. */
type HashMapT = Record<string, string>

type SnapshotT = {
  fingerprint: {
    transactionCount: number
    kosztorysItemCount: number
    grossDepositsWithNet: number
  }
  /** Per-entity hash of the transaction rows that feed that entity's figures — see readInputHashes. */
  inputHashes: { investments: HashMapT; registers: HashMapT; workers: HashMapT }
  investments: Record<string, InvestmentSnapshotT>
  registers: Record<string, number>
  workers: Record<string, number>
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
  totalSettled: 0,
  materialsNetDiscount: 0,
  settledCategoryCosts: [],
  netCategoryCosts: [],
}

const toPairs = (costs: { categoryId: number; total: number }[]): CategoryPairT[] =>
  costs.map((c): CategoryPairT => [c.categoryId, round2(c.total)]).sort((a, b) => a[0] - b[0])

/**
 * A hash over every transaction column that feeds any figure below, taken PER ENTITY: one
 * per investment, per register, per worker.
 *
 * A whole-dataset checksum was the obvious shape and the wrong one. The pre-push hook
 * refreshes `dumps/dump-latest.sql` from prod on every push, so a single new transaction
 * anywhere invalidated the fixture for all 100 investments at once and the suite could
 * only say "regenerate" — a guard that fails on the ordinary path is a guard people learn
 * to regenerate past without reading the diff, which is exactly the moment a real drift
 * gets waved through.
 *
 * Scoped per entity, prod growth silences only the rows it actually touched: an investment
 * whose transactions are byte-identical still has to produce the same figures, and a
 * refactor that moves one is still caught on every untouched row. A register is hashed
 * over the transactions on EITHER side of it, since both move its balance.
 */
async function readInputHashes(payload: Payload) {
  const db = await getDb(payload)
  const result = await db.execute(sql`
    WITH signed AS (
      SELECT
        id, investment_id, source_register_id, target_register_id, worker_id,
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
      UNION ALL
      SELECT 'workers', worker_id, id, sig FROM signed WHERE worker_id IS NOT NULL
    )
    SELECT scope, key, md5(string_agg(sig, ',' ORDER BY id)) AS hash
    FROM scoped GROUP BY scope, key
  `)

  const hashes: SnapshotT['inputHashes'] = { investments: {}, registers: {}, workers: {} }
  for (const row of result.rows) {
    hashes[String(row.scope) as keyof SnapshotT['inputHashes']][String(row.key)] = String(row.hash)
  }

  // Since the read-switch (EX-555) an investment's robocizna and rabat can come from its kosztorys,
  // so the kosztorys rows are an INPUT to the figures below and belong in the per-investment
  // signature. Without them a kosztorys edit would read as code drift (the figure moved, the hash
  // didn't) and — worse — a read that stopped seeing the kosztorys at all would read as nothing.
  //
  // The subcontractor axis (EX-649) is here for the same reason and was the blind spot the second
  // margin exposed: an etap's rozliczenie and a row's stawka move `marginV2` while item count, qty
  // and rabat all stand still, so without them a data edit arrives dressed as code drift.
  const kosztorys = await db.execute(sql`
    SELECT
      ki.investment_id AS key,
      count(*)::int AS item_count,
      coalesce(sum(sp.qty), 0)::text AS qty_done,
      coalesce(inv.global_discount_type, '') || ':' ||
        coalesce(inv.global_discount_value::text, '') AS global_discount,
      md5(
        string_agg(
          -- The legacy bytes, reproduced as literals. EX-766 collapsed the stawka pair into one
          -- nullable column, and hashing the new shape directly would move every kosztorys
          -- fingerprint on a change that moved no money — the twelve comparable investments would
          -- fall out of comparison exactly when they are needed to prove that.
          CASE WHEN ki.w_tools_override_value IS NOT NULL
            THEN 'amount:' || ki.w_tools_override_value::text ELSE ':0' END || ':' ||
          CASE WHEN ki.own_tools_override_value IS NOT NULL
            THEN 'amount:' || ki.own_tools_override_value::text ELSE ':0' END,
          -- NOT ORDER BY ki.id: the seeds insert items with Promise.all, so a re-seed hands the
          -- same rows different serial ids in a different order and this hash moves while nothing
          -- about the data did — the kosztorys axis then goes dark on a fixture nobody can keep
          -- fresh. Section + display order is what the seed actually fixes.
          ',' ORDER BY ki.section_id, ki.display_order, ki.id
        )
      ) AS overrides,
      (
        SELECT md5(
          string_agg(
            coalesce(ks.plane::text, '') || ':' || coalesce(ks.worker_id::text, ''),
            ',' ORDER BY ks.id
          )
        )
        FROM kosztorys_stages ks
        WHERE ks.investment_id = ki.investment_id
      ) AS stages
    FROM kosztorys_items ki
    JOIN investments inv ON inv.id = ki.investment_id
    LEFT JOIN (
      SELECT item_id, sum(qty_done) AS qty FROM stage_progress GROUP BY item_id
    ) sp ON sp.item_id = ki.id
    GROUP BY ki.investment_id, inv.global_discount_type, inv.global_discount_value
  `)

  let kosztorysItemCount = 0
  for (const row of kosztorys.rows) {
    const key = String(row.key)
    kosztorysItemCount += Number(row.item_count)
    const sig = `k:${row.item_count}|${row.qty_done}|${row.global_discount}|${row.overrides}|${row.stages ?? ''}`
    hashes.investments[key] = `${hashes.investments[key] ?? ''}/${sig}`
  }

  // Ride along on the scan that was already counting rows. They are the dataset floor's second axis;
  // what they guard is spelled out at DATASET_FLOOR.
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
  const [inputs, investmentsPage, financialsMap, registerBalances, workerBalances] =
    await Promise.all([
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
      sumAllWorkerBalances(payload),
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
    // Mirrors shapeInvestments(): an investment with no transactions renders as zeros
    // rather than being absent, so the snapshot covers all of them.
    const financials = financialsMap.get(id) ?? ZERO_FINANCIALS
    // Absent means no wpłaty at all, which `shapeInvestments` reads as zero on both planes — the
    // same fallback here, so an investment nobody has paid is frozen rather than skipped.
    const deposits = depositPlaneSums.get(id) ?? NO_DEPOSIT_SUMS
    const vatRate = doc.vatRate ?? DEFAULT_VAT
    investments[String(id)] = {
      totalMaterialCosts: round2(financials.totalMaterialCosts),
      totalIncome: round2(financials.totalIncome),
      totalLaborCosts: round2(financials.totalLaborCosts),
      totalPayouts: round2(financials.totalPayouts),
      totalDiscount: round2(financials.totalDiscount),
      totalLoss: round2(financials.totalLoss),
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
        // A count, not money — it is what the „osierocone wpłaty" marker on the listing renders, so
        // it is an input like the sums and rounding it would be nonsense.
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
      workers: mapToRecord(workerBalances),
    },
    names,
  }
}

/** The dataset floor, asserted in TWO places on purpose: as a test (a thin dataset makes
 *  every comparison trivially pass) and as a precondition on the REGENERATE path, which
 *  overwrites the only committed record of the pre-refactor figures. Regenerating against
 *  a half-restored container would destroy the net and report the reason afterwards. */
/*  `kosztorysItems` carries the floor's whole point onto the new axis: with the kosztorys tables
 *  empty every investment falls back to the transactions plane, so the read-switch branch is never
 *  executed and the suite passes green having tested nothing about it. */
/*  `grossDepositsWithNet` is the same argument on the wpłaty axis: an untagged wpłata counts as
 *  gotówka, so a fixture with no wpłata brutto leaves every bucket but `paidNet` at zero — the
 *  brutto plane is then frozen at nothing and a regression in it passes green. */
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
  let setupError: unknown = null

  beforeAll(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })
      const built = await buildSnapshot(payload)
      snapshot = built.snapshot
      names = built.names
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

    // Without this the missing key reads as "every hash is empty", every entity gets skipped,
    // and the staleness floor below fires with a message blaming prod drift for what is
    // really a fixture predating per-entity hashing. Name the real cause here instead.
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

    /** An entity is comparable only while its transaction rows are byte-identical to the
     *  fixture's. Once prod adds a row it is the DATA that moved, not the code — the only
     *  honest thing the fixture can say about that entity is nothing. */
    const inputsUnchanged = (scope: keyof SnapshotT['inputHashes'], id: string) =>
      (expected.inputHashes[scope][id] ?? '') === (actual.inputHashes[scope][id] ?? '')

    // The `total / 2` floor below counts entities and is blind to WHICH ones, so it cannot see an
    // axis going dark: only a handful of investments carry a wpłata brutto or a kosztorys at all,
    // and if exactly those fall out of the compared set the count barely moves while the figures
    // that are the whole reason this fixture exists are compared on nobody. That is not
    // hypothetical: it is what a seed re-inserting its rows under fresh ids did (EX-725), and
    // `assertNonTrivial` could not catch it because it counts rows in the DB, not comparable
    // entities. So each axis is asserted where it is actually spent: in the compared set.
    //
    // A table rather than one hard-wired check, because the two axes are equally thin and equally
    // seed-fed. Today the kosztorys axis rests on a single investment that happens to also carry
    // brutto — so the brutto check covers it by coincidence, and the coincidence dies the moment a
    // seed puts the two on different investments.
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
        carriedBy: (id: string) => (expected.inputHashes.investments[id] ?? '').includes('/k:'),
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
      // A row the fixture knows and the DB no longer returns: prod deleted it. Same class as
      // an edit — the fixture has nothing to say, and saying "disappeared" would fail a push
      // over someone else's cleanup.
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
      ['workers', expected.workers, actual.workers],
    ] as const) {
      const singular = scope.slice(0, -1)
      for (const key of Object.keys(wasMap)) {
        // Same two escapes as the investment loop above: deleted in prod, or its transactions
        // edited. Either way the fixture has nothing honest left to say about this entity.
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

    // Never a failure — but silence about it would let the fixture rot to nothing while the
    // suite stayed green. The count is the signal to regenerate at your leisure.
    if (dataMoved.length > 0) {
      console.warn(
        `[golden master] ${dataMoved.length} ${dataMoved.length === 1 ? 'entity' : 'entities'} skipped — their transactions changed in prod ` +
          `since the fixture was taken. Refresh at some point with \`pnpm test:golden:update\`.\n  ` +
          dataMoved.slice(0, 10).join('\n  ') +
          (dataMoved.length > 10 ? `\n  …and ${dataMoved.length - 10} more` : ''),
      )
    }

    // The skip rule above is what stops prod growth from failing a push, and it is also the
    // way this guard could quietly become a no-op: let the fixture rot long enough and every
    // entity is skipped, leaving a green test that compares nothing. So the net has a floor.
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
