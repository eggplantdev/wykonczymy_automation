import { differenceNoun } from '@/lib/kosztorys/counted-nouns'
import { formatNet, formatQty, formatQtyWithUnit } from '@/lib/kosztorys/format'
import { toGross } from '@/lib/kosztorys/calc'
import { formatPLN } from '@/lib/utils/format-currency'
import type { DiscountAtVatT, FieldChangeT, ItemRefT, VersionDiffT } from './types'

const FORMAT_BY_FIELD: Record<FieldChangeT['field'], (value: number) => string> = {
  plannedQty: formatQty,
  stageQty: formatQty,
  // The price column's own format — „120" beside a quantity would read as one.
  price: formatPLN,
  plannedNet: formatNet,
  net: formatNet,
}

export const formatChangeValue = (change: FieldChangeT, value: number) =>
  FORMAT_BY_FIELD[change.field](value)

export type ChangeRowT = {
  sectionName: string | null
  description: string
  what: string
  before: string
  after: string
}

const describe = (item: ItemRefT) => item.description ?? '—'

const discountText = (discount: DiscountAtVatT) =>
  discount.type === 'amount'
    ? `${formatPLN(discount.value)} netto / ${formatPLN(toGross(discount.value, discount.vatRate))} brutto`
    : 'brak'

function changeLabel(change: FieldChangeT): string {
  switch (change.field) {
    case 'plannedQty':
      return 'Przedmiar'
    case 'price':
      return 'Cena j.m.'
    case 'stageQty':
      return `Pomiar — ${change.stageLabel}`
    case 'plannedNet':
      return 'Wartość netto przedmiar'
    case 'net':
      return 'Wartość netto'
  }
}

const isDerived = ({ field }: FieldChangeT) => field === 'plannedNet' || field === 'net'

// What someone typed, when there is one: the wartości move because a quantity or a price did, and
// the grid already shows them old → new beside the row. A pozycja's own rabat has no column here,
// so an item whose only change is derived lists the wartości themselves — otherwise it would count
// as „Bez różnic" while the grid shows it changed.
function shownChanges(fields: FieldChangeT[]): FieldChangeT[] {
  const typed = fields.filter((change) => !isDerived(change))
  return typed.length > 0 ? typed : fields
}

export function versionChangeRows(diff: VersionDiffT): ChangeRowT[] {
  const rows: ChangeRowT[] = []
  for (const { item, fields } of diff.changed.values()) {
    for (const change of shownChanges(fields)) {
      const quantity = change.field === 'plannedQty' || change.field === 'stageQty'
      const format = (value: number) =>
        quantity ? formatQtyWithUnit(value, item.unit) : formatChangeValue(change, value)
      rows.push({
        sectionName: item.sectionName,
        description: describe(item),
        what: changeLabel(change),
        before: format(change.before),
        after: format(change.after),
      })
    }
  }
  for (const item of diff.removed) {
    rows.push({
      sectionName: item.sectionName,
      description: describe(item),
      what: 'Usunięta praca',
      before: formatQtyWithUnit(item.plannedQty, item.unit),
      after: '—',
    })
  }
  for (const item of diff.added) {
    rows.push({
      sectionName: item.sectionName,
      description: describe(item),
      what: 'Nowa praca',
      before: '—',
      after: formatQtyWithUnit(item.plannedQty, item.unit),
    })
  }
  if (diff.discount.state === 'changed') {
    rows.push({
      sectionName: null,
      description: 'Cały kosztorys',
      what: 'Rabat',
      before: discountText(diff.discount.before),
      after: discountText(diff.discount.after),
    })
  }
  return rows
}

// The list's count, without formatting a row it never shows: an early version can differ from today
// in every pozycja, and the list builds one of these per entry.
export function countChangeRows(diff: VersionDiffT): number {
  let count = diff.removed.length + diff.added.length
  for (const { fields } of diff.changed.values()) count += shownChanges(fields).length
  return diff.discount.state === 'changed' ? count + 1 : count
}

export const differenceSummary = (count: number) =>
  count === 0
    ? 'Bez różnic względem bieżącej'
    : `${count} ${differenceNoun(count)} względem bieżącej`
