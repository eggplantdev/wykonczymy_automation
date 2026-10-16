// Breaks a saved RSC body into its rows: the largest ones, and the rows containing a needle.
//   node scripts/perf/rsc-rows.mjs dumps/perf/_inwestycje.rsc [needle]
import fs from 'node:fs'
import { kb } from './lib.mjs'

const [file, needle] = process.argv.slice(2)
const text = fs.readFileSync(file, 'utf8')
const rows = text.split('\n')
console.log(`${rows.length} rows, ${kb(text.length)} KB`)
console.log('largest rows:')
for (const row of [...rows].sort((a, b) => b.length - a.length).slice(0, 12))
  console.log(`  ${kb(row.length)} KB  ${row.slice(0, 90)}`)
if (needle) {
  console.log(`rows containing "${needle}":`)
  for (const row of rows.filter((r) => r.includes(needle))) {
    const at = row.indexOf(needle)
    console.log(`  id=${row.slice(0, row.indexOf(':'))} ${kb(row.length)} KB …${row.slice(Math.max(0, at - 300), at + 80)}`)
  }
}
