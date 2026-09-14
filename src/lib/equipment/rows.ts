import { isoOrNull, numOrNull, text } from '@/lib/db/row-coerce'
import { toWarsawDay } from '@/lib/utils/days'
import { EQUIPMENT_STATUSES, type EquipmentStatusT } from './equipment-status'
import type {
  EquipmentEventRowT,
  EquipmentLocationT,
  EquipmentRowT,
  EquipmentTargetT,
} from './types'

/**
 * Raw → view shape for the equipment register. Kept free of SQL and of React so the one piece of
 * real logic here — reading a location out of three mutually exclusive columns — can be asserted
 * without a database or a renderer.
 */

type LocationColumnsT = {
  holder_id: unknown
  holder_name: unknown
  warehouse_id: unknown
  warehouse_name: unknown
  service_provider: unknown
}

/**
 * A day-only column, as the `YYYY-MM-DD` the pickers and the classifiers both speak. Postgres hands
 * these back as a `Date` at midnight UTC, and a full ISO timestamp is exactly what `FormDatePicker`
 * cannot parse — it would render „Edytuj sprzęt" with both dates blank.
 */
const dayOrNull = (value: unknown): string | null =>
  value == null ? null : toWarsawDay(value as Date | string)

/**
 * Precedence is not a policy choice — the write-side invariant guarantees at most one of the three
 * is set, so the order here only decides what a row that broke it would render as. Holder first,
 * because a person is the answer the owner acts on.
 */
export const toLocation = (raw: LocationColumnsT): EquipmentLocationT => {
  if (raw.holder_id != null) {
    return { kind: 'holder', id: Number(raw.holder_id), name: text(raw.holder_name) }
  }
  if (raw.warehouse_id != null) {
    return { kind: 'warehouse', id: Number(raw.warehouse_id), name: text(raw.warehouse_name) }
  }
  // Trimmed here as well as on write: a whitespace-only workshop is not a location, and the mapper
  // also reads rows that predate the hook's own trim.
  const serviceProvider = text(raw.service_provider).trim()
  if (serviceProvider !== '') return { kind: 'service', name: serviceProvider }

  return { kind: 'unknown' }
}

/**
 * The stable identity of a „gdzie jest" filter option. People and warehouses share one dropdown, so
 * their ids would collide on their own; the prefix is what keeps `holder:3` and `warehouse:3` apart.
 * A serwis is one string per repair rather than a dictionary entry, so every service entry answers
 * to the same key — filtering on it means „w serwisie", not „w tym konkretnym warsztacie".
 */
export const locationKey = (location: EquipmentLocationT): string | null => {
  switch (location.kind) {
    case 'holder':
      return `holder:${location.id}`
    case 'warehouse':
      return `warehouse:${location.id}`
    case 'service':
      return 'service'
    case 'unknown':
      return null
  }
}

const toStatus = (value: unknown): EquipmentStatusT => {
  const candidate = text(value) as EquipmentStatusT
  // The column is an enum, so this only fires if someone widened the enum without the constant —
  // and then IN_USE is the reading that keeps the item visible instead of quietly dropping it.
  return EQUIPMENT_STATUSES.includes(candidate) ? candidate : 'IN_USE'
}

export const toEquipmentRow = (raw: Record<string, unknown>): EquipmentRowT => ({
  id: Number(raw.id),
  name: text(raw.name),
  serialNumber: text(raw.serial_number),
  make: text(raw.make),
  model: text(raw.model),
  status: toStatus(raw.status),
  purchaseDate: dayOrNull(raw.purchase_date),
  warrantyUntil: dayOrNull(raw.warranty_until),
  // numOrNull, not `?? 0`: an unknown purchase price renders „—", and 0 zł is a price someone chose.
  purchasePrice: numOrNull(raw.purchase_price),
  note: text(raw.note),
  location: toLocation(raw as LocationColumnsT),
  locatedAt: isoOrNull(raw.occurred_at),
  investmentName: text(raw.investment_name),
})

export const makeModel = (item: { make: string; model: string }): string =>
  [item.make, item.model].filter(Boolean).join(' ')

/** Only a workshop is prefixed — an item there is unavailable. */
export const targetLabel = (target: EquipmentTargetT): string =>
  target.kind === 'service' ? `Serwis: ${target.name}` : target.name

export const toEquipmentEventRow = (raw: Record<string, unknown>): EquipmentEventRowT => ({
  id: Number(raw.id),
  occurredAt: text(isoOrNull(raw.occurred_at)),
  // The cast holds on the invariant, not on the data: a hypothetical targetless row would render as
  // „nieznane" rather than crash, which is what `toLocation` returns for it anyway.
  target: toLocation(raw as LocationColumnsT) as EquipmentTargetT,
  investmentName: text(raw.investment_name),
  cost: numOrNull(raw.cost),
  note: text(raw.note),
  createdByName: text(raw.created_by_name),
})
