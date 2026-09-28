/* eslint-disable -- a `browser_run_code` snippet, not a module: one bare function over browser globals */
// Playwright `browser_run_code` function: times „Dodaj pracę z katalogu" at 1× and 4× CPU throttle.
// Run from an open kosztorys_v2 page of a production build (`pnpm build` + `next start`), logged in.
// The tool loads files only from under `.playwright-mcp/`, so copy it there first.
;async (page) => {
  const RUNS = 5
  const cdp = await page.context().newCDPSession(page)
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b)
    return Math.round(s[Math.floor(s.length / 2)])
  }

  await page.evaluate(() => {
    window.__lt = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration })
    }).observe({ type: 'longtask', buffered: false })
    window.__paint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    window.__blocked = (t0, t1) =>
      Math.round(
        window.__lt
          .filter((e) => e.start >= t0 - 1 && e.start <= t1)
          .reduce((acc, e) => acc + e.dur, 0),
      )
    window.__rows = () => document.querySelectorAll('[role="dialog"] tbody tr').length
    // Committed in the same render as the table, and it changes when the visible set does — a <tr>
    // count cannot say that once the list is virtualised.
    window.__sig = () =>
      [...document.querySelectorAll('[role="dialog"] button')].find((n) =>
        n.textContent.startsWith('Zaznacz widoczne'),
      )?.textContent ?? ''
  })

  async function openDialog() {
    await page.getByRole('button', { name: 'Dodaj' }).first().click()
    await page.getByRole('menuitem', { name: 'Praca z katalogu…' }).waitFor()
    return page.evaluate(async () => {
      const el = [...document.querySelectorAll('[role="menuitem"]')].find((n) =>
        n.textContent.includes('Praca z katalogu'),
      )
      const t0 = performance.now()
      el.click()
      while (!(window.__rows() > 1)) await new Promise((r) => setTimeout(r, 0))
      await window.__paint()
      const t1 = performance.now()
      await new Promise((r) => setTimeout(r, 300))
      return { ms: t1 - t0, blocked: window.__blocked(t0, t1 + 300), rows: window.__rows() }
    })
  }

  async function closeDialog() {
    await page.keyboard.press('Escape')
    await page.locator('[role="dialog"]').waitFor({ state: 'detached' })
    await page.waitForTimeout(300)
  }

  // Unticks „Ukryj już dodane": the whole cennik becomes the list.
  async function showAll() {
    return page.evaluate(async () => {
      const box = [...document.querySelectorAll('[role="dialog"] label')]
        .find((n) => n.textContent.includes('Ukryj już dodane'))
        .querySelector('button[role="checkbox"]')
      const before = window.__sig()
      const t0 = performance.now()
      box.click()
      while (window.__sig() === before) await new Promise((r) => setTimeout(r, 0))
      await window.__paint()
      const t1 = performance.now()
      await new Promise((r) => setTimeout(r, 300))
      return { ms: t1 - t0, blocked: window.__blocked(t0, t1 + 300), rows: window.__sig() }
    })
  }

  // One character into the szukajka: time until the input shows it and until the list has repainted.
  async function typeOne(ch) {
    return page.evaluate(async (ch) => {
      const input = document.querySelector('[role="dialog"] input[placeholder="Szukaj pracy…"]')
      input.focus()
      const before = window.__sig()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      const t0 = performance.now()
      setter.call(input, input.value + ch)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await window.__paint()
      const tInput = performance.now()
      const deadline = t0 + 3000
      while (window.__sig() === before && performance.now() < deadline)
        await new Promise((r) => setTimeout(r, 0))
      await window.__paint()
      const t1 = performance.now()
      await new Promise((r) => setTimeout(r, 300))
      return {
        inputMs: tInput - t0,
        listMs: t1 - t0,
        blocked: window.__blocked(t0, t1 + 300),
        rows: window.__sig(),
      }
    }, ch)
  }

  async function clearSearch() {
    await page.evaluate(async () => {
      const input = document.querySelector('[role="dialog"] input[placeholder="Szukaj pracy…"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.waitForTimeout(600)
  }

  async function tickOne() {
    return page.evaluate(async () => {
      const box = document.querySelector('[role="dialog"] tbody tr button[role="checkbox"]')
      const t0 = performance.now()
      box.click()
      await window.__paint()
      const t1 = performance.now()
      await new Promise((r) => setTimeout(r, 300))
      return { ms: t1 - t0, blocked: window.__blocked(t0, t1 + 300) }
    })
  }

  const results = {}
  for (const rate of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    const open = [],
      key = [],
      tick = [],
      all = []
    for (let i = 0; i < RUNS; i++) {
      open.push(await openDialog())
      all.push(await showAll())
      key.push(await typeOne('m'))
      await clearSearch()
      tick.push(await tickOne())
      await closeDialog()
    }
    results[`cpu${rate}x`] = {
      rowsRendered: open[0].rows,
      open_ms: median(open.map((r) => r.ms)),
      open_blocked_ms: median(open.map((r) => r.blocked)),
      showAll_rows: all[0].rows,
      showAll_ms: median(all.map((r) => r.ms)),
      showAll_blocked_ms: median(all.map((r) => r.blocked)),
      key_input_ms: median(key.map((r) => r.inputMs)),
      key_list_ms: median(key.map((r) => r.listMs)),
      key_blocked_ms: median(key.map((r) => r.blocked)),
      rowsAfterKey: key[0].rows,
      tick_ms: median(tick.map((r) => r.ms)),
      tick_blocked_ms: median(tick.map((r) => r.blocked)),
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return results
}
