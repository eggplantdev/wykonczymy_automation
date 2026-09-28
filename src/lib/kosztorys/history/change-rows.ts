import { differenceNoun } from '@/lib/kosztorys/counted-nouns'
import { formatNet, formatQty } from '@/lib/kosztorys/format'
import type { GlobalDiscountT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import type { FieldChangeT, ItemRefT, VersionDiffT } from './types'

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
  key: string
  sectionName: string | null
  description: string
  what: string
  before: string
  after: string
}

const withUnit = (qty: number, unit: string | null) =>
  [formatQty(qty), unit].filter(Boolean).join(' ')

const describe = (item: ItemRefT) => item.description ?? '—'

const discountText = (discount: GlobalDiscountT) =>
  discount.type === 'amount' ? formatPLN(discount.value) : 'brak'

// Only what someone typed: the wartości move because a quantity, a price or the rabat did, and the
// grid already shows them old → new beside the row.
function whatChanged(change: FieldChangeT): string | null {
  if (change.field === 'plannedQty') return 'Przedmiar'
  if (change.field === 'price') return 'Cena j.m.'
  if (change.field === 'stageQty') return `Pomiar — ${change.stageLabel}`
  return null
}

export function versionChangeRows(diff: VersionDiffT): ChangeRowT[] {
  const rows: ChangeRowT[] = []
  for (const [pastId, { item, fields }] of diff.changed) {
    for (const change of fields) {
      const what = whatChanged(change)
      if (!what) continue
      const quantity = change.field === 'plannedQty' || change.field === 'stageQty'
      const format = (value: number) =>
        quantity ? withUnit(value, item.unit) : formatChangeValue(change, value)
      rows.push({
        key: `changed-${pastId}-${what}`,
        sectionName: item.sectionName,
        description: describe(item),
        what,
        before: format(change.before),
        after: format(change.after),
      })
    }
  }
  for (const item of diff.removed) {
    rows.push({
      key: `removed-${item.id}`,
      sectionName: item.sectionName,
      description: describe(item),
      what: 'Usunięta praca',
      before: withUnit(item.plannedQty, item.unit),
      after: '—',
    })
  }
  for (const item of diff.added) {
    rows.push({
      key: `added-${item.id}`,
      sectionName: item.sectionName,
      description: describe(item),
      what: 'Nowa praca',
      before: '—',
      after: withUnit(item.plannedQty, item.unit),
    })
  }
  if (diff.discount.state === 'changed') {
    rows.push({
      key: 'discount',
      sectionName: null,
      description: 'Cały kosztorys',
      what: 'Rabat',
      before: discountText(diff.discount.before),
      after: discountText(diff.discount.after),
    })
  }
  return rows
}

export const differenceSummary = (count: number) =>
  count === 0
    ? 'Bez różnic względem bieżącej'
    : `${count} ${differenceNoun(count)} względem bieżącej`
