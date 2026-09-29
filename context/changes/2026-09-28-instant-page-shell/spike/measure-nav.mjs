// RUN (against a `pnpm build && pnpm start -p <port>` server — dev mode doesn't prefetch):
//   node context/changes/2026-09-28-instant-page-shell/spike/measure-nav.mjs \
//     --target baseline=http://localhost:3100 --target spike=http://localhost:3101 \
//     --runs 7 --out /path/results.json
//
// Several --target flags are measured interleaved (A, B, A, B …) so machine-load drift lands on both.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const targets = args
  .flatMap((a, i) => (a === '--target' ? [args[i + 1]] : []))
  .map((t) => {
    const [label, url] = t.split('=')
    return { label, url }
  })
const RUNS = Number(flag('runs', '7'))
const OUT = flag('out', null)
const ONLY = flag('only', null)
const EMAIL = 'e2e@wykonczymy.test'
const PASSWORD = 'e2e-test-password-123'

const PROFILES = {
  local: null,
  // Chrome DevTools "Slow 4G".
  slow4g: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
}

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

const LIST_ROUTES = [
  ['/inwestycje', 'Inwestycje'],
  ['/kasy', 'Kasy'],
  ['/zgloszenia', 'Zgłoszenia'],
  ['/kosztorysy', 'Kosztorysy v1'],
  ['/katalog-prac', 'Katalog prac'],
  ['/szablony', 'Szablony kosztorysów'],
  ['/flota', 'Flota'],
  ['/sprzet', 'Sprzęt'],
  ['/pracownicy', 'Pracownicy'],
]

const SCENARIOS = [
  ...LIST_ROUTES.map(([href, title]) => ({
    id: `desktop-nav ${href}`,
    viewport: DESKTOP,
    start: href === '/kasy' ? '/inwestycje' : '/kasy',
    click: `aside nav a[href="${href}"]`,
    path: new RegExp(`^${href}$`),
    title,
  })),
  {
    id: 'desktop-nav / (dashboard)',
    viewport: DESKTOP,
    start: '/kasy',
    click: 'aside nav a[href="/"]',
    path: /^\/$/,
    title: 'Transakcje',
  },
  {
    id: 'desktop-row /kasy → /kasa/[id]',
    viewport: DESKTOP,
    start: '/kasy',
    hover: 'main tbody tr',
    click: 'main tbody tr',
    path: /^\/kasa\/\d+$/,
    title: null,
  },
  {
    id: 'desktop-row /sprzet → /sprzet/[id]',
    viewport: DESKTOP,
    start: '/sprzet',
    hover: 'main tbody tr',
    click: 'main tbody tr',
    path: /^\/sprzet\/\d+$/,
    title: null,
  },
  ...[
    ['/inwestycje', 'Inwestycje'],
    ['/szablony', 'Szablony kosztorysów'],
  ].map(([href, title]) => ({
    id: `mobile-drawer ${href}`,
    viewport: MOBILE,
    start: '/kasy',
    openDrawer: 500,
    click: `#mobile-nav a[href="${href}"]`,
    path: new RegExp(`^${href}$`),
    title,
  })),
  {
    id: 'mobile-drawer-quicktap /inwestycje',
    viewport: MOBILE,
    start: '/kasy',
    openDrawer: 100,
    click: '#mobile-nav a[href="/inwestycje"]',
    path: /^\/inwestycje$/,
    title: 'Inwestycje',
  },
]

async function login(browser, base) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${base}/zaloguj`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Hasło').fill(PASSWORD)
  await page.getByRole('button', { name: /zaloguj/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/zaloguj'), { timeout: 60_000 })
  const state = await context.storageState()
  await context.close()
  return state
}

function instrument({ pathSource, title }) {
  const path = new RegExp(pathSource)
  const main = document.querySelector('main')
  const before = main?.firstElementChild ?? null
  const startTitle = main?.querySelector('h1')?.textContent ?? null
  const m = { t0: null, feedback: null, title: null, ready: null }
  window.__m = m
  document.addEventListener('click', () => (m.t0 ??= performance.now()), { capture: true, once: true })

  const tick = () => {
    if (m.t0 != null) {
      const now = performance.now() - m.t0
      const mainNow = document.querySelector('main')
      const onTarget = path.test(location.pathname)
      if (m.feedback == null && mainNow?.firstElementChild !== before) m.feedback = now
      const h1 = mainNow?.querySelector('h1')?.textContent?.trim() ?? null
      const titleShown = title ? h1 === title : h1 != null && h1 !== startTitle && onTarget
      if (m.title == null && titleShown) m.title = now
      const loaderGone = !mainNow?.textContent?.includes('🚧')
      if (m.ready == null && onTarget && titleShown && loaderGone) m.ready = now
    }
    if (m.ready == null) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function measure(browser, target, scenario, profileName) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    hasTouch: scenario.viewport === MOBILE,
    storageState: target.state,
  })
  try {
    return await measureIn(context, target, scenario, profileName)
  } finally {
    await context.close().catch(() => {})
  }
}

async function measureIn(context, target, scenario, profileName) {
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const profile = PROFILES[profileName]
  if (profile) await cdp.send('Network.emulateNetworkConditions', profile)

  await page.goto(`${target.url}${scenario.start}`)
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(1000)

  if (scenario.openDrawer) {
    await page.getByRole('button', { name: 'Menu' }).click()
    // 500 ms = the slide-in (300 ms) plus a glance; 100 ms = a tap before the links have scrolled
    // into view, so the viewport prefetch hasn't even started — the lessons.md case.
    await page.waitForTimeout(scenario.openDrawer)
  }
  if (scenario.hover) {
    await page.locator(scenario.hover).first().hover()
    await page.waitForTimeout(800)
  }

  await page.evaluate(instrument, { pathSource: scenario.path.source, title: scenario.title })
  // force: Playwright would otherwise wait for the sliding drawer to settle, erasing the quick tap.
  await page.locator(scenario.click).first().click({ force: Boolean(scenario.openDrawer) })
  await page.waitForFunction(() => window.__m?.ready != null, null, { timeout: 20_000, polling: 50 })
  const m = await page.evaluate(() => window.__m)
  return { feedback: m.feedback, title: m.title, ready: m.ready }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}
const fmt = (x) => (x == null ? '—' : `${Math.round(x)}`)

const results = []
const save = () => OUT && writeFileSync(OUT, JSON.stringify(results, null, 2))
const stamp = () => new Date().toTimeString().slice(0, 8)
process.on('uncaughtException', (err) => {
  console.log(`${stamp()} FATAL ${String(err).slice(0, 300)}`)
  save()
  process.exit(1)
})

const browser = await chromium.launch()
for (const target of targets) target.state = await login(browser, target.url)
const scenarios = ONLY ? SCENARIOS.filter((s) => s.id.includes(ONLY)) : SCENARIOS

for (const profileName of Object.keys(PROFILES)) {
  for (const scenario of scenarios) {
    // One discarded warm-up per target: the first hit of a route fills the server's unstable_cache.
    for (const target of targets) await measure(browser, target, scenario, profileName).catch(() => {})
    for (let run = 0; run < RUNS; run++) {
      for (const target of targets) {
        try {
          const r = await measure(browser, target, scenario, profileName)
          results.push({ profile: profileName, scenario: scenario.id, target: target.label, run, ...r })
        } catch (err) {
          results.push({ profile: profileName, scenario: scenario.id, target: target.label, run, error: String(err).slice(0, 200) })
        }
      }
    }
    save()
    for (const target of targets) {
      const all = results.filter((r) => r.profile === profileName && r.scenario === scenario.id && r.target === target.label)
      const rows = all.filter((r) => !r.error)
      const errors = all.filter((r) => r.error)
      console.log(
        [stamp(), profileName, scenario.id.padEnd(36), target.label.padEnd(9),
          `feedback ${fmt(median(rows.map((r) => r.feedback)))}`.padEnd(14),
          `title ${fmt(median(rows.map((r) => r.title)))}`.padEnd(11),
          `ready ${fmt(median(rows.map((r) => r.ready)))}`.padEnd(11),
          `n=${rows.length}`, errors.length ? `ERRORS=${errors.length}: ${errors[0].error.slice(0, 120)}` : ''].join('  '),
      )
    }
  }
}

await browser.close()
save()
console.log(`${stamp()} DONE`)
