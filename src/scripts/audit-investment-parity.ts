// READ-ONLY. Computes the six per-investment figures via BOTH the listing path
// (sumAllInvestmentFinancials) and the detail path (sumFilteredByType + breakdowns
// -> deriveFinancials), diffs them, and writes JSON + CSV to dumps/.
//
// Usage: node --env-file=.env --import tsx src/scripts/audit-investment-parity.ts before
//        node --env-file=.env --import tsx src/scripts/audit-investment-parity.ts after
//
// Avoids the next/cache-wrapped query wrappers (they throw outside Next): it calls the
// raw db aggregation functions directly and lists investments via payload.find.
import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  deriveCategoryBreakdowns,
  deriveFinancials,
  type InvestmentFinancialsT,
} from '@/lib/db/sum-transfers'
import { calculateBalance } from '@/lib/calculate-balance'
import { calculateMargin } from '@/lib/calculate-margin'

type FiguresT = {
  bilans: number
  marza: number
  materialy: number
  wydatkiInwestycyjne: number
  wyplaty: number
  settled: number
}

const figuresOf = (f: InvestmentFinancialsT): FiguresT => ({
  bilans: calculateBalance(f),
  marza: calculateMargin(f),
  materialy: f.totalMaterialCosts,
  wydatkiInwestycyjne: f.categoryCosts.reduce((s, c) => s + c.total, 0),
  wyplaty: f.totalPayouts,
  settled: f.totalSettled,
})

const round2 = (n: number) => Math.round(n * 100) / 100
const FIGURE_KEYS: (keyof FiguresT)[] = [
  'bilans',
  'marza',
  'materialy',
  'wydatkiInwestycyjne',
  'wyplaty',
  'settled',
]

async function main() {
  const label = process.argv[2] ?? 'snapshot'
  const payload = await getPayload({ config })

  const invResult = await payload.find({
    collection: 'investments',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const investments = invResult.docs.map((d) => ({ id: Number(d.id), name: String(d.name) }))

  const listingMap = await sumAllInvestmentFinancials(payload)

  const rows = []
  for (const inv of investments) {
    const where = { investment: { equals: inv.id } }
    const [byType, catRows] = await Promise.all([
      sumFilteredByType(payload, where),
      sumCategoryByTypeSettled(payload, where),
    ])
    const breakdowns = deriveCategoryBreakdowns(catRows)
    const detailFin = deriveFinancials(
      byType,
      breakdowns.categoryCosts,
      breakdowns.settledCategoryCosts,
    )
    const listingFin = listingMap.get(inv.id)

    const detail = figuresOf(detailFin)
    const listing = listingFin
      ? figuresOf(listingFin)
      : (Object.fromEntries(FIGURE_KEYS.map((k) => [k, 0])) as FiguresT)

    const diffs = FIGURE_KEYS.filter((k) => round2(listing[k]) !== round2(detail[k]))
    rows.push({ id: inv.id, name: inv.name, listing, detail, match: diffs.length === 0, diffs })
  }

  writeFileSync(`dumps/parity-${label}.json`, JSON.stringify(rows, null, 2))

  const header = [
    'id',
    'name',
    ...FIGURE_KEYS.flatMap((k) => [`${k}_listing`, `${k}_detail`]),
    'match',
  ].join(',')
  const csvLines = rows.map((r) =>
    [
      r.id,
      `"${r.name.replace(/"/g, '""')}"`,
      ...FIGURE_KEYS.flatMap((k) => [round2(r.listing[k]), round2(r.detail[k])]),
      r.match ? 'TAK' : 'NIE',
    ].join(','),
  )
  writeFileSync(`dumps/parity-${label}.csv`, [header, ...csvLines].join('\n'))

  const outliers = rows.filter((r) => !r.match)
  console.log(`\n${rows.length} investments. Outliers: ${outliers.length}`)
  for (const o of outliers) {
    console.log(`  #${o.id} ${o.name} — differs on: ${o.diffs.join(', ')}`)
    for (const k of o.diffs) {
      console.log(`      ${k}: listing=${round2(o.listing[k])} detail=${round2(o.detail[k])}`)
    }
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
