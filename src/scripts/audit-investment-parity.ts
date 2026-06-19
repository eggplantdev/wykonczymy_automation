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
  sumCategoryBreakdown,
  sumSettledCategoryBreakdown,
  deriveFinancials,
} from '@/lib/db/sum-transfers'
import { extractFigures, type InvestmentFiguresT } from '@/lib/investment-figures'

const round2 = (n: number) => Math.round(n * 100) / 100
const FIGURE_KEYS: (keyof InvestmentFiguresT)[] = [
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
    const [byType, cats, settledCats] = await Promise.all([
      sumFilteredByType(payload, where),
      sumCategoryBreakdown(payload, where),
      sumSettledCategoryBreakdown(payload, where),
    ])
    const detailFin = deriveFinancials(byType, cats, settledCats)
    const listingFin = listingMap.get(inv.id)

    const detail = extractFigures(detailFin)
    const listing = listingFin
      ? extractFigures(listingFin)
      : (Object.fromEntries(FIGURE_KEYS.map((k) => [k, 0])) as InvestmentFiguresT)

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
