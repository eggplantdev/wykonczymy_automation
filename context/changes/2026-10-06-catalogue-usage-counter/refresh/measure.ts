import { readFileSync } from 'node:fs'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  closestEntries,
  hintCandidates,
} from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'

const [out, dump] = process.argv.slice(2)
const rows = (file: string) =>
  readFileSync(`${out}/${file}`, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))

const catalogue = rows('cat.tsv').map(([id, matchKey, description, unit]) => ({
  id: Number(id),
  matchKey,
  description,
  unit,
  descriptionTranslations: {},
  clientPrice: 0,
}))
const keys = new Set(catalogue.map((entry) => entry.matchKey))
const descriptionPart = (key: string) => key.slice(0, key.lastIndexOf('|'))
const catalogueDescriptions = new Set(catalogue.map((entry) => descriptionPart(entry.matchKey)))
// The hint helpers read only opis, j.m. and id; the rest of the katalog row is irrelevant here.
const candidates = hintCandidates(catalogue as unknown as Parameters<typeof hintCandidates>[0])

type OriginT = { rows: number; exact: number; otherUnit: number; hinted: number; none: number }
const origin: Record<string, OriginT> = {}
const kosztorysy = new Set<string>()
const usedKosztorysy = new Set<string>()
const usedCatalogue = new Map<string, { used: Set<string>; done: Set<string> }>()
const missing = new Map<string, { inv: Set<string>; rows: number; desc: string; unit: string }>()
let usedRows = 0

for (const [inv, hasSheet, desc, unit, planned, done] of rows('items.tsv')) {
  kosztorysy.add(inv)
  const isDone = Number(done) > 0
  if (!(Number(planned) > 0 || isDone)) continue
  usedRows++
  usedKosztorysy.add(inv)
  const o = (origin[hasSheet === 't' ? 'z arkusza' : 'z aplikacji'] ??= {
    rows: 0,
    exact: 0,
    otherUnit: 0,
    hinted: 0,
    none: 0,
  })
  o.rows++
  const key = catalogueKey(desc, unit || null)
  if (keys.has(key)) {
    o.exact++
    const entry = usedCatalogue.get(key) ?? { used: new Set(), done: new Set() }
    entry.used.add(inv)
    if (isDone) entry.done.add(inv)
    usedCatalogue.set(key, entry)
    continue
  }
  const group = missing.get(key) ?? { inv: new Set(), rows: 0, desc, unit }
  group.inv.add(inv)
  group.rows++
  missing.set(key, group)
  if (catalogueDescriptions.has(descriptionPart(key))) o.otherUnit++
  else if (closestEntries(desc, candidates).length > 0) o.hinted++
  else o.none++
}

const pct = (part: number, whole: number) => `${Math.round((100 * part) / whole)}%`
console.log(`# Katalog prac — pomiar (${dump})\n`)
console.log(
  `- kosztorysy: ${kosztorysy.size} (z użytą pozycją: ${usedKosztorysy.size}), użyte pozycje: ${usedRows}`,
)
console.log(
  `- prace katalogu z ≥1 użyciem: ${usedCatalogue.size} / ${catalogue.length}, z etapami: ${[...usedCatalogue.values()].filter((e) => e.done.size > 0).length}\n`,
)

console.log(
  '| pochodzenie | użyte | dokładnie | inna j.m. | podpowiedź | nic |\n|---|---|---|---|---|---|',
)
for (const [name, o] of Object.entries(origin))
  console.log(
    `| ${name} | ${o.rows} | ${pct(o.exact, o.rows)} | ${pct(o.otherUnit, o.rows)} | ${pct(o.hinted, o.rows)} | ${pct(o.none, o.rows)} |`,
  )

const groups = [...missing.values()]
const missingRows = groups.reduce((sum, g) => sum + g.rows, 0)
console.log(`\n| w ≥ N kosztorysach | opisów | pozycji (z ${missingRows}) |\n|---|---|---|`)
for (const n of [1, 2, 5, 10, 20]) {
  const hit = groups.filter((g) => g.inv.size >= n)
  console.log(`| ${n} | ${hit.length} | ${hit.reduce((sum, g) => sum + g.rows, 0)} |`)
}

// Automatic first cut of the A/B/C split in change.md — a hint ≥ 0.9 is usually the same praca
// spelled differently, a weaker one usually a generic name the katalog has split into warianty.
const groupOf = (g: (typeof groups)[number], best?: number) => {
  if (catalogueDescriptions.has(descriptionPart(catalogueKey(g.desc, g.unit || null))))
    return 'A? inna j.m.'
  if (best === undefined) return 'C? brak'
  return best >= 0.9 ? 'A? pisownia' : 'B? wariant'
}
console.log('\n## Powtarzające się (≥ 2 kosztorysy)\n')
groups
  .filter((g) => g.inv.size >= 2)
  .sort((left, right) => right.inv.size - left.inv.size)
  .forEach((g) => {
    const hints = closestEntries(g.desc, candidates, 3)
    console.log(`- **[${g.inv.size}] ${g.desc}** (${g.unit}) — ${groupOf(g, hints[0]?.score)}`)
    hints.forEach((h) => console.log(`  - ${h.score.toFixed(2)} ${h.description} (${h.unit})`))
  })
