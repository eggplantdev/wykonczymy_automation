// One request, twice (cold, then warm), and the SQL each caused.
//   node --env-file=.env scripts/perf/probe.mjs <path> [prefetch|rsc|html] [OWNER|MANAGER|EMPLOYEE]
import { BASE, headersFor, kb, login, readSqlLines } from './lib.mjs'

const [path = '/', mode = 'prefetch', role = 'OWNER'] = process.argv.slice(2)
const { cookie } = await login(role)

for (let i = 0; i < 2; i++) {
  const before = readSqlLines().length
  const t0 = Date.now()
  const res = await fetch(`${BASE}${path}`, { headers: headersFor(cookie, mode) })
  const body = await res.text()
  // Statements still finishing after the response (streamed Suspense) land a moment later.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const sql = readSqlLines().slice(before)
  console.log(`#${i} ${mode} ${path} → ${res.status} ${kb(body.length)} KB ${Date.now() - t0} ms, ${sql.length} sql`)
  for (const q of sql) console.log(`    ${q.ms}ms ${q.sql.slice(0, 110)}`)
}
