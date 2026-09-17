import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { selectDepositPlaneSums } from '@/lib/db/deposit-plane-sums'
import { getDepositTransactionsForInvestment } from '@/lib/db/get-deposit-transactions'
import {
  bucketDepositsByPlane,
  NO_DEPOSIT_SUMS,
  type DepositPlaneSumsT,
} from '@/lib/kosztorys/deposit-planes'
import { round2 } from '@/__tests__/helpers/money'

// The wpłata bucketing exists twice — in TS (`bucketDepositsByPlane`, folding the rows the panel
// already holds) and in SQL (`selectDepositPlaneSums`, because the listing has no business shipping
// every wpłata to compute a handful of scalars). Only the TS side had unit tests. This spec compares the two
// implementations directly rather than either against a hand-computed number: a hand-computed
// expectation would pin the SQL to whatever the test author believed the rule was, and the rules here
// („brak wartości = netto"; a wpłata brutto's netto is READ off the faktura, never derived) are
// exactly the ones that keep being misremembered.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const roundSums = (sums: DepositPlaneSumsT): DepositPlaneSumsT => ({
  paidNet: round2(sums.paidNet),
  paidGrossNet: round2(sums.paidGrossNet),
  paidGross: round2(sums.paidGross),
  paidNetCount: sums.paidNetCount,
})

describe.skipIf(!ENV_READY)('selectDepositPlaneSums (DB)', () => {
  let payload: Payload
  let investmentIds: number[] = []
  let sqlSums: Map<number, DepositPlaneSumsT> = new Map()

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const investments = await payload.find({
      collection: 'investments',
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    investmentIds = investments.docs.map((doc) => Number(doc.id))
    sqlSums = new Map(
      (await selectDepositPlaneSums(await getDb(payload))).map(({ investmentId, ...sums }) => [
        investmentId,
        sums,
      ]),
    )
  })

  it('buckets every investment exactly like the TS fold does', async () => {
    const perInvestment = await Promise.all(
      investmentIds.map(async (id) => ({
        id,
        rows: await getDepositTransactionsForInvestment(payload, id),
      })),
    )

    const mismatches: string[] = []
    for (const { id, rows } of perInvestment) {
      const fromRows = roundSums(bucketDepositsByPlane(rows))
      // Absent from the SQL fold means no wpłaty at all, which every caller reads as zero on both
      // planes — so the absence has to compare EQUAL to that zero, not be skipped.
      const fromSql = roundSums(sqlSums.get(id) ?? NO_DEPOSIT_SUMS)
      if (JSON.stringify(fromRows) !== JSON.stringify(fromSql)) {
        mismatches.push(
          `#${id} (${rows.length} wpłat): rows=${JSON.stringify(fromRows)} sql=${JSON.stringify(fromSql)}`,
        )
      }
    }

    expect(mismatches).toEqual([])
  })

  it('is folding a dataset that actually contains wpłaty brutto', () => {
    // Without this the spec above can pass comparing zero with zero on every investment: untagged
    // counts as gotówka, so a fixture with no wpłata brutto leaves both brutto buckets empty and
    // never touches the brutto half of either implementation.
    const totals = [...sqlSums.values()].reduce(
      (acc, sums) => ({
        paidGross: acc.paidGross + sums.paidGross,
        paidGrossNet: acc.paidGrossNet + sums.paidGrossNet,
      }),
      { paidGross: 0, paidGrossNet: 0 },
    )

    const empty = Object.entries(totals)
      .filter(([, value]) => value <= 0)
      .map(([bucket]) => bucket)

    expect(
      empty,
      `db-test has nothing in ${empty.join(', ')} — run \`pnpm seed:deposits:test\``,
    ).toEqual([])
  })
})
