import { describe, expect, it } from 'vitest'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  cellKeystroke,
  cellPaste,
  cellSettle,
  numericFieldPolicy,
  type CellEditPolicyT,
} from '@/lib/kosztorys/cell-edit'
import { discountPolicy, type DiscountPairT } from '@/lib/kosztorys/discount-edit'

type QtyRowT = { id: number; plannedQty: number }

const qty = numericFieldPolicy<'plannedQty', QtyRowT>('plannedQty', String)
const row = (plannedQty: number): QtyRowT => ({ id: 1, plannedQty })

// Stand-ins for the two guard severities, so both machine branches are tested without dragging the
// subcontractor price guard's own rules into it.
const capped: CellEditPolicyT<QtyRowT, number> = {
  ...qty,
  guard: (candidate) =>
    candidate.plannedQty > 100 ? { severity: 'refuse', message: 'za dużo' } : null,
}

const warned: CellEditPolicyT<QtyRowT, number> = {
  ...qty,
  guard: (candidate) =>
    candidate.plannedQty > 100 ? { severity: 'warn', message: 'dużo, ale niech będzie' } : null,
}

describe('cellKeystroke', () => {
  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(cellKeystroke('12,5', row(0), qty)).toEqual({ kind: 'commit', row: row(12.5) })
  })

  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // Writing the cleared value here would flip the cell out of edit mode mid-typing: the input is
    // swapped for read-only text, the caret dies and the old value reappears under the user's hands.
    expect(cellKeystroke('', row(7), qty)).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(cellKeystroke('-', row(7), qty)).toEqual({ kind: 'hold' })
    expect(cellKeystroke('1e', row(7), qty)).toEqual({ kind: 'hold' })
  })

  it('kolejne klawisze ułamka dochodzą do pełnej liczby, nie do sklejonych cyfr', () => {
    // The rabat cell stored „12,5" as 125: it committed 12 on the comma, re-rendered over the typed
    // text, and the „5" landed on a „12" that had lost its separator.
    expect(cellKeystroke('12', row(0), qty)).toMatchObject({ kind: 'commit', row: row(12) })
    expect(cellKeystroke('12,', row(12), qty)).toMatchObject({ kind: 'commit', row: row(12) })
    expect(cellKeystroke('12,5', row(12), qty)).toMatchObject({ kind: 'commit', row: row(12.5) })
  })

  it('guard odrzuca wartość, zanim wiersz ją przyjmie', () => {
    expect(cellKeystroke('101', row(5), capped)).toMatchObject({ kind: 'blocked' })
    expect(cellKeystroke('99', row(5), capped)).toMatchObject({ kind: 'commit' })
  })

  it('ostrzeżenie zapisuje wartość i milczy do czasu wyjścia z komórki', () => {
    // `toEqual`, not `toMatchObject`: the silence is the assertion. A warning reaching this result
    // is what would fire a toast per keystroke.
    expect(cellKeystroke('101', row(5), warned)).toEqual({ kind: 'commit', row: row(101) })
  })
})

describe('cellSettle', () => {
  it('puste pole zeruje dopiero po wyjściu z komórki', () => {
    expect(cellSettle('', row(7), qty, 7)).toEqual({ kind: 'clear', row: row(0) })
  })

  it('przyjęta wartość nie wymaga zapisu — wiersz już ją ma', () => {
    expect(cellSettle('12,5', row(12.5), qty, 7)).toEqual({ kind: 'keep', warning: null })
  })

  it('odrzucony wpis cofa wiersz do stanu sprzed edycji', () => {
    // The prefix trap: typing „1e" committed „1" first, so walking away used to leave a quantity of
    // 1 standing in place of the 7 that was there.
    expect(cellSettle('1e', row(1), qty, 7)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: row(7),
      restored: row(7),
    })
  })

  it('cofnięcie do stanu, w którym wiersz już jest, nic nie zapisuje — ale nadal jest odrzuceniem', () => {
    expect(cellSettle('1e', row(7), qty, 7)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: null,
      restored: row(7),
    })
  })

  it('odrzucenie z guardu niesie własny powód', () => {
    expect(cellSettle('101', row(101), capped, 5)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: row(5),
    })
  })

  it('ostrzeżona wartość zostaje w wierszu i dopiero tu dostaje swój komunikat', () => {
    expect(cellSettle('101', row(101), warned, 5)).toEqual({
      kind: 'keep',
      warning: 'dużo, ale niech będzie',
    })
  })

  it('podaje przywróconą wartość do ogłoszenia', () => {
    const settled = cellSettle('1e', row(1), qty, 7)
    expect(settled.kind === 'rollback' && qty.restoredLabel(settled.restored)).toBe('7')
  })
})

describe('cellPaste', () => {
  it('wkleja to samo, co da się wpisać z klawiatury', () => {
    // The gap this closes: the strip of the sheet's NBSP thousands separator lived only on the
    // column's own paste hook, so „1 234,5" landed when pasted onto a selection and was refused as
    // invalid when the same text was typed — or pasted into an already-open cell.
    const pasted = cellPaste('1\u00a0234,5', row(0), qty)
    expect(pasted).toEqual(row(1234.5))
    expect(cellKeystroke('1\u00a0234,5', row(0), qty)).toMatchObject({
      kind: 'commit',
      row: pasted,
    })
  })

  it('guard odrzuca wklejoną wartość tak samo jak wpisaną', () => {
    expect(cellPaste('101', row(5), capped)).toEqual(row(5))
    expect(cellPaste('99', row(5), capped)).toEqual(row(99))
  })

  it('ostrzeżenie nie zabiera wklejonej wartości', () => {
    expect(cellPaste('101', row(5), warned)).toEqual(row(101))
  })

  it('wklejone śmieci zostawiają wiersz w spokoju', () => {
    expect(cellPaste('-', row(7), qty)).toEqual(row(7))
  })

  it('wklejona pustka czyści przez politykę — w rabacie zdejmuje też typ', () => {
    expect(cellPaste('', row(7), qty)).toEqual(row(0))
    expect(cellPaste('', { discountType: 'percent', discountValue: 10 }, discountPolicy())).toEqual(
      {
        discountType: null,
        discountValue: 0,
      },
    )
  })
})

describe('discountPolicy', () => {
  const policy = discountPolicy<DiscountPairT>()
  const noDiscount: DiscountPairT = { discountType: null, discountValue: 0 }

  it('wpisana wartość bez typu domyśla się procentu', () => {
    expect(cellKeystroke('10', noDiscount, policy)).toMatchObject({
      kind: 'commit',
      row: { discountType: 'percent', discountValue: 10 },
    })
  })

  it('nie nadpisuje typu wybranego wcześniej', () => {
    expect(
      cellKeystroke('250', { discountType: 'amount', discountValue: 0 }, policy),
    ).toMatchObject({ kind: 'commit', row: { discountType: 'amount', discountValue: 250 } })
  })

  it('wyczyszczone pole zdejmuje rabat razem z typem', () => {
    // A value with no type is inert — it looks like a live rabat and contributes nothing.
    expect(
      cellSettle('', { discountType: 'percent', discountValue: 10 }, policy, noDiscount),
    ).toEqual({ kind: 'clear', row: noDiscount })
  })

  // EX-736: 100% is work given away and passes; above it the row's net goes negative.
  it('odrzuca rabat procentowy powyżej 100%', () => {
    expect(cellKeystroke('101', noDiscount, policy)).toMatchObject({ kind: 'blocked' })
    expect(cellKeystroke('100', noDiscount, policy)).toMatchObject({
      kind: 'commit',
      row: { discountType: 'percent', discountValue: 100 },
    })
  })

  it('nie stawia sufitu rabatowi kwotowemu — 250 zł to nie 250%', () => {
    expect(
      cellKeystroke('250', { discountType: 'amount', discountValue: 0 }, policy),
    ).toMatchObject({ kind: 'commit' })
  })

  it('wyjście z komórki wycofuje odrzucony rabat i mówi dlaczego', () => {
    const entry: DiscountPairT = { discountType: 'percent', discountValue: 10 }
    expect(
      cellSettle('150', { discountType: 'percent', discountValue: 15 }, policy, entry),
    ).toEqual({ kind: 'rollback', reason: 'blocked', row: entry, restored: entry })
  })

  it('wklejenie ponad sufit zostawia wiersz bez zmian', () => {
    const current: DiscountPairT = { discountType: 'percent', discountValue: 10 }
    expect(cellPaste('150', current, policy)).toBe(current)
  })

  it('ogłasza przywrócony rabat w jednostce, którą wiersz niósł', () => {
    expect(policy.restoredLabel({ discountType: 'percent', discountValue: 10 })).toBe('10%')
    expect(policy.restoredLabel({ discountType: 'amount', discountValue: 250 })).toBe(
      formatPLN(250),
    )
    expect(policy.restoredLabel(noDiscount)).toBe('brak rabatu')
  })
})
