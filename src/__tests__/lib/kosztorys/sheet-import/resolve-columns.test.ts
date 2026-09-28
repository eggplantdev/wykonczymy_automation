import { describe, expect, it } from 'vitest'
import {
  resolveLaborColumns,
  resolveRates,
  type ResolveFailureT,
  type ResolvedLaborColumnsT,
  type ResolvedRatesT,
  type LaborColumnsFailureT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import {
  ALTOWA_LABOR_HEADER,
  BIALOSTOCKA_RATES_HEADER,
  BIALOSTOCKA_LABOR_HEADER,
  PRZEDPOLE_LABOR_HEADER,
  UNNAMED_NET_VALUE_LABOR_HEADER,
  ZUPNICZA_LABOR_HEADER,
} from '@/__tests__/fixtures/kosztorys-sheet/header-blocks'

function expectResolved(
  result: ResolvedLaborColumnsT | LaborColumnsFailureT,
): asserts result is ResolvedLaborColumnsT {
  if (!result.ok) expect.fail(`expected a resolved header, got: ${result.problems.join(' | ')}`)
}

function expectRatesResolved(
  result: ResolvedRatesT | ResolveFailureT,
): asserts result is ResolvedRatesT {
  if (!result.ok) expect.fail(`expected resolved rates, got: ${result.problems.join(' | ')}`)
}

describe('resolveLaborColumns', () => {
  it('resolves the wide 10-etap layout', () => {
    const result = resolveLaborColumns(BIALOSTOCKA_LABOR_HEADER)
    expectResolved(result)

    expect(result.columns).toMatchObject({
      section: 0, // A
      description: 2, // C
      plannedQty: 13, // N — Przedmiar
      unit: 15, // P
      clientPrice: 16, // Q
      discount: 17, // R — rabat
      netValue: 18, // S — Wartość netto
    })
    expect(result.stages).toEqual({ firstColumn: 3, count: 10 }) // D–M
  })

  it('resolves a narrow layout where Przedmiar sits four columns earlier', () => {
    const result = resolveLaborColumns(PRZEDPOLE_LABOR_HEADER)
    expectResolved(result)

    expect(result.columns).toMatchObject({
      section: 0,
      description: 2,
      plannedQty: 9, // J, not N
      unit: 11, // L
      clientPrice: 12, // M
      discount: 13, // N — „rabat" here, not Przedmiar
      netValue: 14, // O
    })
    expect(result.stages).toEqual({ firstColumn: 3, count: 6 }) // D–I
  })

  it('finds stages by the „wykonano" marker even when row 3 renames them to crews', () => {
    // Row 3 reads „1 etap BRYGADA JEDEN" / „3 etap EKIPA DWA" — no „ilość" anywhere.
    const result = resolveLaborColumns(PRZEDPOLE_LABOR_HEADER)
    expectResolved(result)
    expect(result.stages.count).toBe(6)
  })

  it('does not mistake the wartość block for more etapy', () => {
    // Row 1 labels the money block identically to the qty block (V1 is =D1). Only row 2 differs.
    const result = resolveLaborColumns(BIALOSTOCKA_LABOR_HEADER)
    expectResolved(result)
    expect(result.stages.count).toBe(10) // not 20
  })

  it('resolves a layout where the money block is not adjacent to Wartość netto', () => {
    const result = resolveLaborColumns(ALTOWA_LABOR_HEADER)
    expectResolved(result)

    expect(result.columns).toMatchObject({ plannedQty: 13, netValue: 18 })
    expect(result.stages).toEqual({ firstColumn: 3, count: 10 })
  })

  it('reads a split „Wartość netto" off the Pomiar z natury column, not the Przedmiar one', () => {
    // S prices Przedmiar (the offer), T prices Pomiar z natury — and T is what the sheet counts: the
    // section total sums T and „pozostało do rozliczenia" is T minus the etapy.
    const result = resolveLaborColumns(ZUPNICZA_LABOR_HEADER)
    expectResolved(result)

    expect(result.columns.netValue).toBe(19) // T
  })

  it('recognises the Pomiar-side wartość column by its row-3 wording alone', () => {
    const grid = ZUPNICZA_LABOR_HEADER.map((row) => [...row])
    grid[0][19] = ''
    grid[2][19] = 'Wartość pomiar z natury '

    const result = resolveLaborColumns(grid)
    expectResolved(result)
    expect(result.columns.netValue).toBe(19)
  })

  it('reports nothing unresolved when every optional column is there', () => {
    const result = resolveLaborColumns(BIALOSTOCKA_LABOR_HEADER)
    expectResolved(result)

    expect(result.missingFields).toEqual([])
  })

  it('finds „Pomiar z natury" beside Przedmiar', () => {
    const result = resolveLaborColumns(BIALOSTOCKA_LABOR_HEADER)
    expectResolved(result)

    expect(result.columns.measuredQty).toBe(14)
  })

  it('imports a sheet with no „Pomiar z natury" column rather than refusing it', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    grid[0][14] = ''
    grid[2][14] = ''

    const result = resolveLaborColumns(grid)
    expectResolved(result)
    expect(result.columns.measuredQty).toBeUndefined()
    expect(result.missingFields).toContainEqual({
      field: 'measuredQty',
      required: false,
      reason: 'absent',
    })
  })

  it('imports a sheet whose „Pomiar z natury" matches twice rather than refusing it', () => {
    // An optional column the resolver cannot pin down is dropped, not escalated: refusing here would
    // reject a sheet that imported fine before the column was ever looked for.
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    grid[0][20] = grid[0][14]
    grid[2][20] = grid[2][14]

    const result = resolveLaborColumns(grid)
    expectResolved(result)
    expect(result.columns.measuredQty).toBeUndefined()
    // The report has to tell the two apart: „dopisz kolumnę" vs „zmień nazwę tej drugiej".
    expect(result.missingFields).toContainEqual({
      field: 'measuredQty',
      required: false,
      reason: 'ambiguous',
    })
  })

  it('treats a missing rabat column as fine — some sheets genuinely have none', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    grid[0][17] = '' // blank out „rabat"

    const result = resolveLaborColumns(grid)
    expectResolved(result)
    expect(result.columns.discount).toBeUndefined()
  })

  it('fails by naming the missing column rather than throwing', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    grid[0][16] = '' // „Cena j.m." on row 1
    grid[2][16] = '' // „cena j.m." on row 3

    const result = resolveLaborColumns(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('Cena j.m.')
  })

  it('fails when a required column matches twice, instead of picking the leftmost', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    grid[0][19] = 'Przedmiar' // a second one at T

    const result = resolveLaborColumns(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('Przedmiar')
  })

  // Both sides of a failed match, because the owner repairs it by pairing them: the field that has no
  // column, and the columns that have no field.
  describe('the two sides of a failed match', () => {
    function expectRefused(
      result: ResolvedLaborColumnsT | LaborColumnsFailureT,
    ): asserts result is LaborColumnsFailureT {
      if (result.ok) expect.fail('expected the header to be refused')
    }

    it('names the required field it could not place', () => {
      const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER)
      expectRefused(result)

      expect(result.missingFields).toContainEqual({
        field: 'netValue',
        required: true,
        reason: 'absent',
      })
    })

    it('offers an unclaimed column as a candidate, named the way the sheet names it', () => {
      const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER)
      expectRefused(result)

      expect(result.candidates).toContainEqual({
        column: 18,
        letter: 'S',
        labels: ['Wartość netto przedmiar'],
      })
    })

    it('leaves out a column another field already owns', () => {
      const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER)
      expectRefused(result)

      // N/Q are Przedmiar and Cena j.m.; U is komentarz. Offering a resolved column would invite the
      // owner to point two fields at one column.
      const columns = result.candidates.map((candidate) => candidate.column)
      expect(columns).not.toContain(13) // N
      expect(columns).not.toContain(16) // Q
      expect(columns).not.toContain(20) // U
    })

    it('leaves out the etapy run and the columns read off its position', () => {
      const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER)
      expectRefused(result)

      const columns = result.candidates.map((candidate) => candidate.column)
      expect(columns.filter((column) => column >= 3 && column <= 12)).toEqual([]) // D–M
      expect(columns).not.toContain(0) // A — nazwa sekcji
      expect(columns).not.toContain(2) // C — opis pracy
    })

    it('leaves out the ordinal column even when it is labelled', () => {
      const grid = UNNAMED_NET_VALUE_LABOR_HEADER.map((row) => [...row])
      grid[0][1] = 'Lp.' // B, between nazwa sekcji and opis pracy

      const result = resolveLaborColumns(grid)
      expectRefused(result)

      expect(result.candidates.map((candidate) => candidate.column)).not.toContain(1)
    })

    it('leaves out a column with nothing typed in it — it names nothing to point at', () => {
      const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER)
      expectRefused(result)

      expect(result.candidates.map((candidate) => candidate.column)).not.toContain(1) // B — blank
    })
  })

  it('fails when no row carries the „wykonano" marker', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    grid[1] = grid[1].map((cell) => (cell === 'wykonano' ? '' : cell))

    const result = resolveLaborColumns(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('wykonano')
  })

  // Opis is read off the column left of the first etap; with none there, a pass would import every
  // row with no opis at all.
  it('fails when the etapy start in column A, leaving no column for the opis', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => row.slice(3))

    const result = resolveLaborColumns(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems).toContain('Brak kolumny z opisem pracy przed kolumnami etapów.')
  })
})

describe('resolveRates', () => {
  it('separates the two rate columns from the client price they share a label with', () => {
    // „cena j.m." appears at P (client price), R (z narzędziami) and T (bez narzędzi).
    const result = resolveRates(BIALOSTOCKA_RATES_HEADER)
    expectRatesResolved(result)

    expect(result.columns).toMatchObject({
      description: 1, // B — the rates tabs have no section column
      wToolsRate: 17, // R, under „cennik z narzędziami"
      ownToolsRate: 19, // T, under „cennik bez narzędzi"
    })
  })

  it('matches a banner typed without Polish diacritics', () => {
    // Białostocka's „z narzędziami" tab spells its own banner „cennik z narzedziami" — the same
    // sheet, one tab over, spells it with the ę.
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    for (const rowIndex of [0, 1]) {
      grid[rowIndex] = grid[rowIndex].map((cell) =>
        cell === 'cennik z narzędziami ' ? 'cennik z narzedziami' : cell,
      )
    }

    const result = resolveRates(grid)
    expectRatesResolved(result)
    expect(result.columns.wToolsRate).toBe(17)
  })

  it('matches banners named by who does the work rather than by tooling', () => {
    // Altowa splits the price lists as „podwykonawca" / „pracownik" — same two lists, other axis.
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    for (const rowIndex of [0, 1]) {
      grid[rowIndex] = grid[rowIndex].map((cell) =>
        cell === 'cennik z narzędziami '
          ? 'cennik podwykonawca'
          : cell === 'cennik bez narzędzi '
            ? 'cennik pracownik '
            : cell,
      )
    }

    const result = resolveRates(grid)
    expectRatesResolved(result)
    expect(result.columns).toMatchObject({ wToolsRate: 17, ownToolsRate: 19 })
  })

  it('finds a banner that sits on row 2 only', () => {
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    grid[0][17] = '' // R1
    grid[0][18] = '' // S1 — the banner survives on row 2 alone

    const result = resolveRates(grid)
    expectRatesResolved(result)
    expect(result.columns.wToolsRate).toBe(17)
  })

  it('fails when a rate group is missing rather than falling back to the client price', () => {
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    grid[0][19] = '' // „cennik bez narzędzi" group label at T
    grid[0][20] = ''

    const result = resolveRates(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('bez narzędzi')
  })
})
