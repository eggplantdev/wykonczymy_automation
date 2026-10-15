// Loads each page in a real browser and assigns every SQL statement to the load whose time window it
// fell in. Run 1 is cold, the rest warm (median). Writes dumps/perf/results/<label>.json.
//   node --env-file=.env scripts/perf/measure.mjs <label> [runs]
// PERF_INVESTMENT / PERF_WORKER pick the detail pages (defaults are preview ids with real data).
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { BASE, OUT_DIR, credentials, readSqlLines } from './lib.mjs'

const label = process.argv[2] ?? 'run'
const RUNS = Number(process.argv[3] ?? 4)
const investment = process.env.PERF_INVESTMENT ?? '26'
const worker = process.env.PERF_WORKER ?? '30'

const PAGES = {
  OWNER: [
    { name: 'transakcje', path: '/' },
    { name: 'inwestycje', path: '/inwestycje' },
    { name: `inwestycja-${investment}`, path: `/inwestycje/${investment}` },
    { name: `kosztorys-v2-${investment}`, path: `/inwestycje/${investment}/kosztorys_v2` },
    { name: 'pracownicy', path: '/pracownicy' },
    { name: `pracownik-${worker}`, path: `/pracownicy/${worker}` },
    { name: 'kasy', path: '/kasy' },
  ],
  // The worker's own page, on a phone — the id is whichever account STAGING_QA_WORKER_EMAIL is.
  EMPLOYEE: [{ name: 'worker-own', path: (userId) => `/pracownicy/${userId}`, mobile: true }],
}

// Longest chain of queries where each starts after the previous ended = DB round trips on the
// critical path, i.e. what latency multiplies.
function waterfallDepth(queries) {
  const intervals = queries
    .map((q) => ({ start: q.start, end: q.start + q.ms }))
    .sort((a, b) => a.start - b.start)
  const best = intervals.map(() => 1)
  for (let i = 0; i < intervals.length; i++)
    for (let j = 0; j < i; j++)
      if (intervals[j].end <= intervals[i].start) best[i] = Math.max(best[i], best[j] + 1)
  return Math.max(0, ...best)
}

// Payload's ORM emits lowercase SQL; the raw-SQL layer in src/lib/db writes uppercase.
const isPayloadOrm = (sql) => /^(select|insert|update|delete|with) /.test(sql)

async function measureLoad(page, url) {
  const before = readSqlLines().length
  const requests = []
  const onResponse = async (response) => {
    const request = response.request()
    let bytes = 0
    try {
      bytes = (await response.body()).length
    } catch {}
    requests.push({
      method: request.method(),
      url: request.url().replace(BASE, ''),
      type: request.resourceType(),
      action: Boolean(request.headers()['next-action']),
      bytes,
    })
  }
  page.on('response', onResponse)
  const started = Date.now()
  await page.goto(url, { waitUntil: 'networkidle' })
  const nav = await page.evaluate(async () => {
    const entry = performance.getEntriesByType('navigation')[0]
    const lcp = await new Promise((resolve) => {
      new PerformanceObserver((list) => resolve(list.getEntries().at(-1))).observe({
        type: 'largest-contentful-paint',
        buffered: true,
      })
      setTimeout(() => resolve(undefined), 200)
    })
    return {
      ttfb: Math.round(entry.responseStart - entry.requestStart),
      load: Math.round(entry.loadEventEnd),
      lcp: lcp ? Math.round(lcp.startTime) : undefined,
    }
  })
  await page.waitForTimeout(500)
  page.off('response', onResponse)
  const wall = Date.now() - started
  const queries = readSqlLines().slice(before)

  const documentBytes = requests.find((r) => r.type === 'document')?.bytes ?? 0
  const fetches = requests.filter((r) => r.type === 'fetch' || r.type === 'xhr')
  return {
    wall,
    ...nav,
    documentKB: Math.round(documentBytes / 1024),
    afterLoadFetches: fetches.map((r) => `${r.method} ${r.url}${r.action ? ' [action]' : ''}`),
    sql: queries.length,
    sqlOrm: queries.filter((q) => isPayloadOrm(q.sql)).length,
    sqlMs: Math.round(queries.reduce((sum, q) => sum + q.ms, 0)),
    depth: waterfallDepth(queries),
    statements: queries.map((q) => `${q.ms}ms ${q.sql.slice(0, 140)}`),
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const browser = await chromium.launch()
const results = {}
for (const [role, pages] of Object.entries(PAGES)) {
  const context = await browser.newContext(
    pages[0].mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  )
  const response = await context.request.post(`${BASE}/api/users/login`, { data: credentials(role) })
  if (!response.ok()) throw new Error(`login ${role}: ${response.status()}`)
  const { user } = await response.json()
  const page = await context.newPage()
  for (const target of pages) {
    const path = typeof target.path === 'function' ? target.path(user.id) : target.path
    const runs = []
    for (let i = 0; i < RUNS; i++) runs.push(await measureLoad(page, `${BASE}${path}`))
    const warm = runs.slice(1)
    results[target.name] = {
      path,
      cold: runs[0],
      warm: {
        sql: median(warm.map((r) => r.sql)),
        sqlOrm: median(warm.map((r) => r.sqlOrm)),
        depth: median(warm.map((r) => r.depth)),
        sqlMs: median(warm.map((r) => r.sqlMs)),
        ttfb: median(warm.map((r) => r.ttfb)),
        lcp: median(warm.map((r) => r.lcp ?? 0)),
        wall: median(warm.map((r) => r.wall)),
        documentKB: median(warm.map((r) => r.documentKB)),
        afterLoadFetches: warm.at(-1).afterLoadFetches,
        statements: warm.at(-1).statements,
      },
    }
  }
  await context.close()
}
await browser.close()

fs.mkdirSync(`${OUT_DIR}/results`, { recursive: true })
fs.writeFileSync(`${OUT_DIR}/results/${label}.json`, JSON.stringify(results, null, 2))

const row = (cells) => cells.map((c) => String(c).padEnd(16)).join('')
console.log(row(['page', 'cold sql/depth', 'warm sql/orm', 'warm depth', 'warm ttfb', 'warm lcp', 'doc KB', 'fetches']))
for (const [name, r] of Object.entries(results))
  console.log(
    row([
      name,
      `${r.cold.sql}/${r.cold.depth}`,
      `${r.warm.sql}/${r.warm.sqlOrm}`,
      r.warm.depth,
      r.warm.ttfb,
      r.warm.lcp,
      r.warm.documentKB,
      r.warm.afterLoadFetches.length,
    ]),
  )
