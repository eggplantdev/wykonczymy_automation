// Playwright MCP `browser_run_code` body; needs the perf kosztorys on inwestycja 7 and a viewport wide
// enough to render the „Etap 1" column, or the run returns the headers it did find.
;async (page) => {
  const STAGING = 'https://wykonczymy-git-staging-wykonczymys-projects.vercel.app'
  const PREVIEW =
    'https://wykonczymy-git-perf-ex-1116-commit-ac9f2d-wykonczymys-projects.vercel.app'
  const PATH = '/inwestycje/7/kosztorys_v2'
  const ROW_Y = 330

  await page.goto(STAGING + PATH)
  await page.waitForTimeout(3000)
  const backup = await page.evaluate(() => {
    const all = { ...localStorage }
    for (const key of Object.keys(localStorage))
      if (key !== 'table-columns:kosztorys-totals-open') localStorage.removeItem(key)
    return all
  })

  const cellValue = (x) =>
    page.evaluate(
      ([x, y]) => {
        const cell = document.elementFromPoint(x, y)?.closest('.dsg-cell')
        return cell?.querySelector('input')?.value ?? cell?.innerText
      },
      [x, ROW_Y],
    )
  const nextPaint = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))),
        ),
    )

  const series = async (x) => {
    const original = await cellValue(x)
    // Keys typed past the cell paint nothing and read as the two-frame floor, faking a win.
    if (original === undefined) throw new Error(`no grid cell at ${x},${ROW_Y}`)
    const latencies = []
    try {
      for (let round = 0; round < 3; round++) {
        await page.mouse.click(x, ROW_Y)
        await page.waitForTimeout(300)
        for (const key of '123456789') {
          const start = await page.evaluate(() => performance.now())
          await page.keyboard.press(key)
          latencies.push((await nextPaint()) - start)
        }
        const typed = await cellValue(x)
        if (typed !== '123456789') throw new Error(`cell at ${x} holds "${typed}" after typing`)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1500)
      }
    } finally {
      await page.mouse.click(x, ROW_Y)
      await page.waitForTimeout(300)
      await page.keyboard.type(String(original))
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2500)
    }
    const restored = await cellValue(x)
    if (restored !== original)
      throw new Error(`cell at ${x} restored to "${restored}", was "${original}"`)
    const sorted = [...latencies].sort((a, b) => a - b)
    const quantile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
    return {
      median: +quantile(0.5).toFixed(1),
      p90: +quantile(0.9).toFixed(1),
      max: +sorted.at(-1).toFixed(1),
    }
  }

  const run = async (base) => {
    await page.goto(base + PATH)
    // The totals panel defaults to open on a fresh origin and covers the cells under test.
    await page.evaluate(() => localStorage.setItem('table-columns:kosztorys-totals-open', 'closed'))
    await page.reload()
    await page.waitForTimeout(6000)
    const centers = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll('.dsg-row-header .dsg-cell')].map((cell) => {
          const box = cell.getBoundingClientRect()
          return [cell.innerText.replace(/\s+/g, ' ').trim(), Math.round(box.left + box.width / 2)]
        }),
      ),
    )
    const env = base === STAGING ? 'staging' : 'preview'
    const przedmiarX = centers['Przedmiar ofertowy']
    const etapX = centers['Etap 1']
    if (!przedmiarX || !etapX) return { env, error: Object.keys(centers).join(' | ') }
    return { env, przedmiar: await series(przedmiarX), etap1: await series(etapX) }
  }

  const results = []
  try {
    // Interleaved, so a warm-up or ordering effect hits both deployments equally.
    for (const base of [STAGING, PREVIEW, STAGING, PREVIEW, STAGING, PREVIEW])
      results.push(await run(base))
  } finally {
    await page.goto(STAGING + PATH)
    await page.waitForTimeout(2000)
    await page.evaluate((saved) => {
      localStorage.clear()
      for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value)
    }, backup)
  }
  return results
}
