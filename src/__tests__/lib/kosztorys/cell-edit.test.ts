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

const capped: CellEditPolicyT<QtyRowT> = {
  ...qty,
  guard: (candidate) =>
    candidate.plannedQty > 100 ? { severity: 'refuse', message: 'za dużo' } : null,
}

const warned: CellEditPolicyT<QtyRowT> = {
  ...qty,
  guard: (candidate) =>
    candidate.plannedQty > 100 ? { severity: 'warn', message: 'dużo, ale niech będzie' } : null,
}

describe('cellKeystroke', () => {
  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(cellKeystroke('12,5', row(0), qty)).toEqual({ kind: 'accept', row: row(12.5) })
  })

  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    expect(cellKeystroke('', row(7), qty)).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(cellKeystroke('-', row(7), qty)).toEqual({ kind: 'hold' })
    expect(cellKeystroke('1e', row(7), qty)).toEqual({ kind: 'hold' })
  })

  it('guard odrzuca wartość, zanim wiersz ją przyjmie', () => {
    expect(cellKeystroke('101', row(5), capped)).toMatchObject({ kind: 'blocked' })
    expect(cellKeystroke('99', row(5), capped)).toMatchObject({ kind: 'accept' })
  })

  it('ostrzeżenie milczy do czasu wyjścia z komórki', () => {
    expect(cellKeystroke('101', row(5), warned)).toEqual({ kind: 'accept', row: row(101) })
  })
})

describe('cellSettle', () => {
  it('puste pole zeruje dopiero po wyjściu z komórki', () => {
    expect(cellSettle('', row(7), qty)).toEqual({ kind: 'clear', row: row(0) })
  })

  it('przyjęta wartość trafia do wiersza dopiero tutaj', () => {
    expect(cellSettle('12,5', row(7), qty)).toEqual({
      kind: 'commit',
      row: row(12.5),
      warning: null,
    })
  })

  it('niedokończony wpis odrzuca bez zapisu', () => {
    expect(cellSettle('1e', row(7), qty)).toEqual({ kind: 'reject', reason: 'invalid' })
  })

  it('odrzucenie z guardu niesie własny powód', () => {
    expect(cellSettle('101', row(5), capped)).toEqual({ kind: 'reject', reason: 'blocked' })
  })

  it('ostrzeżona wartość trafia do wiersza i dopiero tu dostaje swój komunikat', () => {
    expect(cellSettle('101', row(5), warned)).toEqual({
      kind: 'commit',
      row: row(101),
      warning: 'dużo, ale niech będzie',
    })
  })
})

describe('cellPaste', () => {
  it('wkleja to samo, co da się wpisać z klawiatury', () => {
    const pasted = cellPaste('1 234,5', row(0), qty)
    expect(pasted).toEqual(row(1234.5))
    expect(cellSettle('1 234,5', row(0), qty)).toMatchObject({
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

  it('wklejone działanie ląduje jako jego wynik', () => {
    expect(cellPaste('3,5x2', row(0), qty)).toEqual(row(7))
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
    expect(cellSettle('10', noDiscount, policy)).toMatchObject({
      kind: 'commit',
      row: { discountType: 'percent', discountValue: 10 },
    })
  })

  it('nie nadpisuje typu wybranego wcześniej', () => {
    expect(cellSettle('250', { discountType: 'amount', discountValue: 0 }, policy)).toMatchObject({
      kind: 'commit',
      row: { discountType: 'amount', discountValue: 250 },
    })
  })

  it('wyczyszczone pole zdejmuje rabat razem z typem', () => {
    expect(cellSettle('', { discountType: 'percent', discountValue: 10 }, policy)).toEqual({
      kind: 'clear',
      row: noDiscount,
    })
  })

  it('odrzuca rabat procentowy powyżej 100%', () => {
    expect(cellSettle('101', noDiscount, policy)).toEqual({ kind: 'reject', reason: 'blocked' })
    expect(cellSettle('100', noDiscount, policy)).toMatchObject({
      kind: 'commit',
      row: { discountType: 'percent', discountValue: 100 },
    })
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
