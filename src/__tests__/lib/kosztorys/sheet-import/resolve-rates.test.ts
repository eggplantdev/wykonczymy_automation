import { describe, expect, it } from 'vitest'
import { resolveItemRates, type RateTabT } from '@/lib/kosztorys/sheet-import/resolve-rates'

const tab = (
  title: string,
  rows: ReadonlyArray<{
    description: string
    wTools: number
    ownTools: number
    typed?: boolean
  }>,
): RateTabT => ({
  title,
  rows: rows.map(({ description, wTools, ownTools, typed = false }) => ({
    description,
    wToolsRate: wTools,
    ownToolsRate: ownTools,
    wToolsTyped: typed,
    ownToolsTyped: typed,
    wToolsTracksPrice: !typed,
    ownToolsTracksPrice: !typed,
  })),
})

const items = (...descriptions: string[]) => descriptions.map((description) => ({ description }))

describe('resolveItemRates', () => {
  it('takes the rate where both tabs agree', () => {
    const resolved = resolveItemRates(items('gruntowanie'), [
      tab('bez narzędzi', [{ description: 'gruntowanie', wTools: 5.1, ownTools: 3 }]),
      tab('z narzędziami', [{ description: 'gruntowanie', wTools: 5.1, ownTools: 3 }]),
    ])

    expect(resolved[0]).toMatchObject({ wToolsRate: 5.1, ownToolsRate: 3, kind: 'agree' })
  })

  it('never mixes one rate from each tab — a disagreement enters blank instead', () => {
    const resolved = resolveItemRates(items('malowanie'), [
      tab('bez narzędzi', [{ description: 'malowanie', wTools: 10, ownTools: 8, typed: true }]),
      tab('z narzędziami', [{ description: 'malowanie', wTools: 20, ownTools: 16 }]),
    ])

    expect(resolved[0]).toMatchObject({ kind: 'conflict', wToolsRate: 0, ownToolsRate: 0 })
  })

  it('sends a praca whose bez-narzędzi rate exceeds its z-narzędziami rate to the owner', () => {
    const resolved = resolveItemRates(items('gruntowanie'), [
      tab('bez narzędzi', [{ description: 'gruntowanie', wTools: 3, ownTools: 5.1, typed: true }]),
      tab('z narzędziami', [{ description: 'gruntowanie', wTools: 5.1, ownTools: 3 }]),
    ])

    expect(resolved[0]).toMatchObject({ kind: 'conflict', conflictReason: 'incoherent' })
    expect(resolved[0].candidates).toHaveLength(2)
  })

  it('takes the only tab that has the praca at all', () => {
    const resolved = resolveItemRates(items('prace projektowe'), [
      tab('bez narzędzi', []),
      tab('z narzędziami', [{ description: 'prace projektowe', wTools: 3500, ownTools: 3500 }]),
    ])

    expect(resolved[0]).toMatchObject({
      wToolsRate: 3500,
      kind: 'single',
      sourceTab: 'z narzędziami',
    })
  })

  it('does not let a hand-typed cell settle a disagreement', () => {
    const resolved = resolveItemRates(items('szpachlowanie'), [
      tab('bez narzędzi', [{ description: 'szpachlowanie', wTools: 26, ownTools: 20 }]),
      tab('z narzędziami', [
        { description: 'szpachlowanie', wTools: 30, ownTools: 24, typed: true },
      ]),
    ])

    expect(resolved[0]).toMatchObject({
      kind: 'conflict',
      conflictReason: 'disagree',
      wToolsRate: 0,
      sourceTab: null,
    })
    expect(resolved[0].candidates).toHaveLength(2)
  })

  it('reports every kwota that was in play so the owner can arbitrate', () => {
    const resolved = resolveItemRates(items('akrylowanie'), [
      tab('bez narzędzi', [{ description: 'akrylowanie', wTools: 12, ownTools: 9, typed: true }]),
      tab('z narzędziami', [{ description: 'akrylowanie', wTools: 15, ownTools: 11, typed: true }]),
    ])

    expect(resolved[0]).toMatchObject({
      kind: 'conflict',
      wToolsRate: 0,
      ownToolsRate: 0,
      sourceTab: null,
    })
    expect(resolved[0].candidates).toEqual([
      {
        tab: 'bez narzędzi',
        wToolsRate: 12,
        ownToolsRate: 9,
        wToolsTyped: true,
        ownToolsTyped: true,
      },
      {
        tab: 'z narzędziami',
        wToolsRate: 15,
        ownToolsRate: 11,
        wToolsTyped: true,
        ownToolsTyped: true,
      },
    ])
  })

  // The sheet renders an unfilled cell as 0, so „za darmo" and „niewypełnione" are the same figure —
  // and the hand-typed rule would otherwise hand the whole praca to whichever tab was filled in.
  it('treats an empty pair against a filled one as a conflict rather than taking the filled one', () => {
    const resolved = resolveItemRates(items('demontaż'), [
      tab('bez narzędzi', [{ description: 'demontaż', wTools: 0, ownTools: 0 }]),
      tab('z narzędziami', [{ description: 'demontaż', wTools: 40, ownTools: 30, typed: true }]),
    ])

    expect(resolved[0]).toMatchObject({ kind: 'conflict', wToolsRate: 0, ownToolsRate: 0 })
    expect(resolved[0].candidates).toHaveLength(2)
  })

  it('marks a lone impossible pair as a misread rather than a disagreement', () => {
    const resolved = resolveItemRates(items('gruntowanie'), [
      tab('z narzędziami', [{ description: 'gruntowanie', wTools: 3, ownTools: 5.1 }]),
    ])

    expect(resolved[0]).toMatchObject({ kind: 'conflict', conflictReason: 'incoherent' })
  })

  it('reports a praca missing from every tab instead of guessing a rate', () => {
    const resolved = resolveItemRates(items('nieznana praca'), [tab('bez narzędzi', [])])

    expect(resolved[0]).toMatchObject({ kind: 'missing', wToolsRate: 0, ownToolsRate: 0 })
  })

  it('matches repeated descriptions by their nth occurrence, not by row', () => {
    // „gładź" appears in two sections with different prices. Joining by row index — what the seeder
    // does — misattributes every rate below the first row where the tabs diverge.
    const resolved = resolveItemRates(items('gładź', 'inna praca', 'gładź'), [
      tab('bez narzędzi', [
        { description: 'gładź', wTools: 10, ownTools: 8 },
        { description: 'gładź', wTools: 30, ownTools: 24 },
        { description: 'inna praca', wTools: 99, ownTools: 70 },
      ]),
    ])

    expect(resolved.map((rate) => rate.wToolsRate)).toEqual([10, 99, 30])
  })
})
