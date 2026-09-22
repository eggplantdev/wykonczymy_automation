import { describe, expect, it } from 'vitest'
import { cellKeystroke, cellSettle } from '@/lib/kosztorys/cell-edit'
import { formatPLN } from '@/lib/utils/format-currency'
import { modeChange, subcontractorPolicy } from '@/lib/kosztorys/subcontractor-price-edit'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// The grid's own call shape: the cell hands `useCellDraft` a policy and the machine does the rest,
// so the spec drives the same two functions rather than a wrapper only it would keep alive.
const keystroke = (raw: string, rowData: ViewPricingT, view: ToolPlaneT) =>
  cellKeystroke(raw, rowData, subcontractorPolicy<ViewPricingT>(view))

const settle = (draft: string, rowData: ViewPricingT, view: ToolPlaneT, entry: number | null) =>
  cellSettle(draft, rowData, subcontractorPolicy<ViewPricingT>(view), entry)

// Client price 100 makes every threshold readable at a glance: ceiling 65, which the w_tools
// coefficient price meets exactly.
const row: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

const flat = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideValue: value,
})

describe('cellKeystroke pod polityką podwykonawcy', () => {
  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // The bug this guards: writing `type: null` here swapped the input for read-only text mid-edit,
    // killing the caret and restoring the old price.
    expect(keystroke('', flat(60), 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(keystroke('1e', flat(60), 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('wpisana cena przestawia „auto" na kwotę stałą', () => {
    expect(keystroke('50', row, 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 50 },
    })
  })

  it('wpisana cena zastępuje poprzednią kwotę stałą', () => {
    expect(keystroke('62', flat(50), 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 62 },
    })
  })

  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(keystroke('50,5', flat(60), 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 50.5 },
    })
  })

  it('zapisuje cenę powyżej stawki z mnożnika inwestycji — pod sufitem to zwykła cena', () => {
    // The default 0,65 mnożnik now sits ON the ceiling, so the band above it only exists on an
    // investment priced below the cap.
    const lowerCoeff = { ...flat(50), globalWToolsCoeff: 0.5 }
    expect(keystroke('60', lowerCoeff, 'w_tools').kind).toBe('commit')
  })

  it('zapisuje cenę powyżej sufitu bez słowa — ostrzeżenie czeka na wyjście z komórki', () => {
    expect(keystroke('66', flat(60), 'w_tools')).toEqual({
      kind: 'commit',
      row: { ...flat(60), wToolsOverrideValue: 66 },
    })
  })

  it('blokuje cenę ujemną — to jedyna twarda odmowa', () => {
    expect(keystroke('-50', flat(60), 'w_tools').kind).toBe('blocked')
  })

  it('pisze do pól planu, w którym edytujemy', () => {
    expect(keystroke('30', flat(60), 'own_tools')).toMatchObject({
      kind: 'commit',
      row: { ownToolsOverrideValue: 30, wToolsOverrideValue: 60 },
    })
  })
})

describe('cellSettle pod polityką podwykonawcy', () => {
  const entry = 60

  it('puste pole wraca do „auto" dopiero po wyjściu z komórki', () => {
    expect(settle('', flat(60), 'w_tools', entry)).toMatchObject({
      kind: 'clear',
      row: { wToolsOverrideValue: null },
    })
  })

  it('przyjęta wartość nie wymaga dopisku — wiersz już ją ma', () => {
    expect(settle('60', flat(60), 'w_tools', entry)).toEqual({ kind: 'keep', warning: null })
  })

  it('cena ponad sufitem zostaje, a ostrzeżenie czeka na wyjście z komórki', () => {
    expect(settle('66', flat(66), 'w_tools', entry)).toEqual({
      kind: 'keep',
      warning: expect.stringContaining('65,00'),
    })
  })

  it('podaje przywróconą cenę, żeby dało się ją ogłosić', () => {
    const settled = settle('-50', flat(60), 'w_tools', entry)
    expect(
      settled.kind === 'rollback' &&
        subcontractorPolicy<ViewPricingT>('w_tools').restoredLabel(settled.restored),
    ).toBe(formatPLN(60))
  })

  it('niedokończony wpis cofa się jako „nieprawidłowy"', () => {
    expect(settle('1e', flat(1), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: { wToolsOverrideValue: 60 },
    })
  })

  it('cofnięcie do stanu, w którym wiersz już jest, nic nie zapisuje — ale nadal jest odrzuceniem', () => {
    // Typing „-50" never commits a prefix („-" is held), so the row never left the entry price and
    // there is nothing to write back. The rollback still fires: it is what stops the refused draft
    // from being mistaken for an accepted one.
    expect(settle('-50', flat(60), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: null,
      restored: { wToolsOverrideValue: 60 },
    })
  })

  it('odrzucona cena nie zostawia wiersza na prefiksie „9"', () => {
    // The prefix trap from the „auto" side: typing „9e" commits the leading „9" first, so walking
    // away used to strand the row at 9 zł — a price nobody chose.
    const autoEntry = null
    expect(settle('9e', flat(9), 'w_tools', autoEntry)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: { wToolsOverrideValue: null },
    })
  })
})

describe('modeChange', () => {
  it('„auto" → „kwota stała" zamraża cenę, którą wiersz już pokazuje', () => {
    expect(modeChange(row, true, 'w_tools')).toMatchObject({
      wToolsOverrideValue: 65,
    })
  })

  it('zamraża cenę planu, w którym przełączamy źródło', () => {
    const switched = modeChange(row, true, 'own_tools')
    expect(switched.ownToolsOverrideValue).toBeCloseTo(55, 6)
    expect(switched.wToolsOverrideValue).toBeNull()
  })

  it('powrót do „auto" oddaje wiersz mnożnikowi inwestycji', () => {
    expect(modeChange(flat(60), false, 'w_tools')).toMatchObject({
      wToolsOverrideValue: null,
    })
  })
})
