import { createRequire } from 'node:module'
// pg is not a direct dependency; borrow the copy @payloadcms/db-postgres ships with.
const pg = createRequire(import.meta.resolve('@payloadcms/db-postgres'))('pg')
import { writeFileSync } from 'node:fs'
import { catalogueKey } from '../../../src/lib/kosztorys/work-catalogue/catalogue-key.ts'
import { foldDescription } from '../../../src/lib/kosztorys/sheet-import/item-key.ts'
import {
  closestEntries,
  hintCandidates,
} from '../../../src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DB_URL })
  await client.connect()
  const cat = await client.query(
    'SELECT id, description, unit, client_price, match_key FROM work_catalogue_items',
  )
  const catalogue = cat.rows.map((r) => ({
    ...r,
    clientPrice: r.client_price,
    matchKey: r.match_key,
    descriptionTranslations: {},
  }))
  const keys = new Set(catalogue.map((c) => c.matchKey))
  const byFolded = new Map<string, typeof catalogue>()
  for (const c of catalogue) {
    const f = foldDescription(c.description)
    byFolded.set(f, [...(byFolded.get(f) ?? []), c])
  }
  const candidates = hintCandidates(catalogue as never)
  const res = await client.query(`
    SELECT ki.description, ki.unit, ki.investment_id, i.status, (i.trashed_at IS NOT NULL) AS trashed,
      (ki.planned_qty > 0 OR COALESCE(ki.current_planned_qty, 0) > 0
        OR EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = ki.id AND sp.qty_done > 0)) AS used
    FROM kosztorys_items ki
    JOIN investments i ON i.id = ki.investment_id
    LEFT JOIN work_catalogue_items w ON w.id = ki.catalogue_item_id
    WHERE w.id IS NULL`)
  type G = {
    description: string
    unit: string | null
    rows: number
    inv: Set<number>
    usedInv: Set<number>
    liveInv: Set<number>
  }
  const groups = new Map<string, G>()
  for (const r of res.rows) {
    const key = catalogueKey(r.description ?? '', r.unit)
    if (keys.has(key)) continue
    let g = groups.get(key)
    if (!g) {
      g = {
        description: r.description ?? '',
        unit: r.unit,
        rows: 0,
        inv: new Set(),
        usedInv: new Set(),
        liveInv: new Set(),
      }
      groups.set(key, g)
    }
    g.rows++
    g.inv.add(r.investment_id)
    if (r.used) g.usedInv.add(r.investment_id)
    if (!r.trashed && ['active', 'quote', 'planowana'].includes(r.status))
      g.liveInv.add(r.investment_id)
  }
  const out = [...groups.values()]
    .map((g) => {
      const sameText = byFolded.get(foldDescription(g.description)) ?? []
      const hints = closestEntries(g.description, candidates)
      const kind =
        sameText.length > 0
          ? 'A-unit'
          : hints.length > 0
            ? hints[0].score >= 0.85
              ? 'A-spelling?'
              : 'hint'
            : 'none'
      return {
        description: g.description,
        unit: g.unit,
        rows: g.rows,
        investments: g.inv.size,
        usedIn: g.usedInv.size,
        liveIn: g.liveInv.size,
        kind,
        sameText: sameText.map((c) => `#${c.id} ${c.unit}`).join(', '),
        hints: hints.map((h) => `#${h.id} ${h.score.toFixed(2)} ${h.description} [${h.unit}]`),
      }
    })
    .sort((a, b) => b.investments - a.investments || b.rows - a.rows)
  writeFileSync(new URL('./alias-list.json', import.meta.url), JSON.stringify(out, null, 1))
  const sum = (f: (o: (typeof out)[number]) => boolean) => {
    const s = out.filter(f)
    return { texts: s.length, rows: s.reduce((n, o) => n + o.rows, 0) }
  }
  console.log({
    all: sum(() => true),
    repeated2: sum((o) => o.investments >= 2),
    repeated5: sum((o) => o.investments >= 5),
    single: sum((o) => o.investments === 1),
    usedAnywhere: sum((o) => o.usedIn > 0),
    inLiveInvestments: sum((o) => o.liveIn > 0),
    byKind: Object.fromEntries(
      ['A-unit', 'A-spelling?', 'hint', 'none'].map((k) => [k, sum((o) => o.kind === k)]),
    ),
    byKindRepeated: Object.fromEntries(
      ['A-unit', 'A-spelling?', 'hint', 'none'].map((k) => [
        k,
        sum((o) => o.kind === k && o.investments >= 2),
      ]),
    ),
  })
  await client.end()
}
main()
