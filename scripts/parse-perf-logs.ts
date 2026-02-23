/**
 * Parses [PERF] timing lines from Next.js server stdout
 * and outputs a markdown baseline table.
 *
 * Usage:
 *   pnpm build && pnpm start 2>&1 | tee /tmp/perf.log
 *   cat /tmp/perf.log | pnpm perf:parse
 *   cat /tmp/perf.log | pnpm perf:parse --verbose
 */

const verbose = process.argv.includes('--verbose')

// ── Types ────────────────────────────────────────────────────────────

type EntryT = {
  page: string
  operation: string
  cold: number | undefined
  warm: number | '(cached)' | undefined
}

// ── Page identification from labels ──────────────────────────────────

const PAGE_PATTERNS: Array<{ pattern: RegExp; page: (m: RegExpMatchArray) => string }> = [
  { pattern: /^ManagerDashboard\b/, page: () => '/' },
  { pattern: /^kasa\/(\S+)/, page: () => '/kasa/[id]' },
  { pattern: /^inwestycje\/(\S+)/, page: () => '/inwestycje/[id]' },
  { pattern: /^UserTransferView\((\S+?)\)/, page: () => '/uzytkownicy/[id]' },
]

const PAGE_DISPLAY: Record<string, string> = {
  '/': '`/` (dashboard)',
  '/kasa/[id]': '`/kasa/[id]`',
  '/inwestycje/[id]': '`/inwestycje/[id]`',
  '/uzytkownicy/[id]': '`/uzytkownicy/[id]`',
}

// ── Regexes ──────────────────────────────────────────────────────────

// [PERF] <label> <number>ms  — optionally prefixed with "Cache  "
const PERF_RE = /^(?:\s*Cache\s+)?\[PERF\]\s+(.+?)\s+([\d.]+)ms/

// GET /<path> <status> in <time> (...render: <time>...)
const GET_RE = /GET\s+(\/\S*)\s+\d+\s+in\s+([\d.]+)(s|ms).*?render:\s*([\d.]+)(s|ms)/

// ── Helpers ──────────────────────────────────────────────────────────

const isQueryLine = (label: string) => label.startsWith('query.')
const isCacheDupe = (raw: string) => /^\s*Cache\s+/.test(raw)

const identifyPage = (label: string): string | undefined => {
  for (const { pattern, page } of PAGE_PATTERNS) {
    const m = label.match(pattern)
    if (m) return page(m)
  }
  if (label.startsWith('TransferTableServer')) return undefined // inherit
  return undefined
}

const extractOperation = (label: string): string => {
  // Strip page prefix to get clean operation name
  for (const { pattern } of PAGE_PATTERNS) {
    const m = label.match(pattern)
    if (m) {
      // Remove the page prefix, keep the operation part
      const afterPrefix = label.slice(m[0].length).trim()
      return afterPrefix || label
    }
  }
  return label
}

const toMs = (value: string, unit: string): number =>
  unit === 's' ? Math.round(parseFloat(value) * 1000) : Math.round(parseFloat(value))

// ── Parsing ──────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

const input = await readStdin()

const lines = input.split('\n')

// key = `${page}|${operation}`, values = array of ms timings
const timings = new Map<string, number[]>()
// Ordered list of unique keys for stable output
const keyOrder: string[] = []

let currentPage = '/'

for (const raw of lines) {
  // Skip Cache-prefixed duplicates
  if (isCacheDupe(raw)) continue

  // Try GET line first
  const getMatch = raw.match(GET_RE)
  if (getMatch) {
    const [, path, , , renderVal, renderUnit] = getMatch
    const renderMs = toMs(renderVal, renderUnit)

    // Identify page from the GET path
    let page: string
    if (path === '/') page = '/'
    else if (path.startsWith('/kasa/')) page = '/kasa/[id]'
    else if (path.startsWith('/inwestycje/')) page = '/inwestycje/[id]'
    else if (path.startsWith('/uzytkownicy/')) page = '/uzytkownicy/[id]'
    else page = path

    const operation = 'Full page render'
    const key = `${page}|${operation}`
    if (!timings.has(key)) {
      timings.set(key, [])
      keyOrder.push(key)
    }
    timings.get(key)!.push(renderMs)
    currentPage = page
    continue
  }

  // Try [PERF] line
  const perfMatch = raw.match(PERF_RE)
  if (!perfMatch) continue

  const [, label, msStr] = perfMatch
  const ms = Math.round(parseFloat(msStr))

  // Skip query.* lines unless --verbose
  if (!verbose && isQueryLine(label)) continue

  // Identify which page this belongs to
  const detectedPage = identifyPage(label)
  if (detectedPage) currentPage = detectedPage

  const page = currentPage
  const operation = extractOperation(label)

  // Skip empty operations (page prefix was the entire label)
  if (!operation) continue

  const key = `${page}|${operation}`
  if (!timings.has(key)) {
    timings.set(key, [])
    keyOrder.push(key)
  }
  timings.get(key)!.push(ms)
}

// ── Build entries ────────────────────────────────────────────────────

const entries: EntryT[] = keyOrder.map((key) => {
  const [page, operation] = key.split('|')
  const values = timings.get(key)!

  return {
    page,
    operation,
    cold: values[0],
    warm: values.length > 1 ? values[1] : '(cached)',
  }
})

if (entries.length === 0) {
  console.error('No [PERF] or GET lines found in input.')
  console.error(
    'Pipe server logs: pnpm start 2>&1 | tee /tmp/perf.log && cat /tmp/perf.log | pnpm perf:parse',
  )
  process.exit(1)
}

// ── Output markdown table ────────────────────────────────────────────

const header = '| Page | Operation | Cold (ms) | Warm (ms) |'
const separator = '|---|---|---|---|'

console.log(header)
console.log(separator)

for (const { page, operation, cold, warm } of entries) {
  const pageLabel = PAGE_DISPLAY[page] ?? `\`${page}\``
  const opLabel = operation === 'Full page render' ? `**Full page** render` : `\`${operation}\``
  const coldStr = cold !== undefined ? String(cold) : '-'
  const warmStr = warm === '(cached)' ? '(cached)' : warm !== undefined ? String(warm) : '-'

  console.log(`| ${pageLabel} | ${opLabel} | ${coldStr} | ${warmStr} |`)
}
