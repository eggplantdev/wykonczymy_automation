import { itemAddedPhrase, itemNounLocative, itemRemovedPhrase } from '@/lib/kosztorys/counted-nouns'
import { formatQty } from '@/lib/kosztorys/format'
import { QTY_TOLERANCE } from '@/lib/kosztorys/settlement-rows'
import type { GlobalDiscountT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import type { FieldChangeT, VersionDiffT } from './types'

const SEPARATOR = ' · '

export const discountText = (discount: GlobalDiscountT) =>
  discount.type === 'amount' ? formatPLN(discount.value) : 'brak'

const signedQty = (qty: number) => `${qty > 0 ? '+' : ''}${formatQty(qty)}`

type StageTallyT = { label: string; items: number; delta: number; units: Set<string> }

// One line per etap. A sum is only a figure when every pozycja behind it counts in one j.m. —
// „+12" across m² and mb is a number that measures nothing, so a mixed etap reports its count.
function stagePhrases(diff: VersionDiffT): string[] {
  const tallies = new Map<number, StageTallyT>()
  for (const { item, fields } of diff.changed.values()) {
    for (const field of fields) {
      if (field.field !== 'stageQty') continue
      const tally = tallies.get(field.stageId) ?? {
        label: field.stageLabel,
        items: 0,
        delta: 0,
        units: new Set<string>(),
      }
      tally.items++
      tally.delta += field.after - field.before
      tally.units.add(item.unit ?? '')
      tallies.set(field.stageId, tally)
    }
  }

  return [...tallies.values()].map(({ label, items, delta, units }) => {
    const [unit] = units
    if (units.size === 1 && Math.abs(delta) > QTY_TOLERANCE) {
      return `Pomiar w etapie ${label}: ${[signedQty(delta), unit].filter(Boolean).join(' ')}`
    }
    return `Pomiar w etapie ${label} zmieniony w ${items} ${itemNounLocative(items)}`
  })
}

function countChanged(diff: VersionDiffT, field: FieldChangeT['field']): number {
  let count = 0
  for (const { fields } of diff.changed.values()) {
    if (fields.some((change) => change.field === field)) count++
  }
  return count
}

// „Wartość" is left out: it moves only because a quantity, a price or a rabat did, and those are
// already named.
export function summarizeChange(diff: VersionDiffT): string {
  const parts: string[] = []
  if (diff.added.length > 0)
    parts.push(`${diff.added.length} ${itemAddedPhrase(diff.added.length)}`)
  if (diff.removed.length > 0) {
    parts.push(`${diff.removed.length} ${itemRemovedPhrase(diff.removed.length)}`)
  }
  const planned = countChanged(diff, 'plannedQty')
  if (planned > 0) parts.push(`Przedmiar zmieniony w ${planned} ${itemNounLocative(planned)}`)
  const priced = countChanged(diff, 'price')
  if (priced > 0) parts.push(`Cena j.m. zmieniona w ${priced} ${itemNounLocative(priced)}`)
  parts.push(...stagePhrases(diff))
  if (diff.discount.state === 'changed') {
    parts.push(
      `Rabat: ${discountText(diff.discount.before)} → ${discountText(diff.discount.after)}`,
    )
  }
  return parts.join(SEPARATOR)
}
