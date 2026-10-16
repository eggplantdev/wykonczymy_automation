import { isoOrNull, numOrNull, text } from '@/lib/db/row-coerce'
import { toWarsawDay } from '@/lib/utils/days'
import { EQUIPMENT_STATUSES, type EquipmentStatusT } from './equipment-status'
import type {
  EquipmentEventRowT,
  EquipmentLocationT,
  EquipmentRowT,
  EquipmentTargetT,
} from './types'

type LocationColumnsT = {
  holder_id: unknown
  holder_name: unknown
  warehouse_id: unknown
  warehouse_name: unknown
  service_provider: unknown
}

/**
 * a full ISO timestamp is exactly what `FormDatePicker`
 * cannot parse — it would render „Edytuj sprzęt" with both dates blank.
 */
const dayOrNull = (value: unknown): string | null =>
  value == null ? null : toWarsawDay(value as Date | string)

export const toLocation = (raw: LocationColumnsT): EquipmentLocationT => {
  if (raw.holder_id != null) {
    return { kind: 'holder', id: Number(raw.holder_id), name: text(raw.holder_name) }
  }
  if (raw.warehouse_id != null) {
    return { kind: 'warehouse', id: Number(raw.warehouse_id), name: text(raw.warehouse_name) }
  }
  const serviceProvider = text(raw.service_provider).trim()
  if (serviceProvider !== '') return { kind: 'service', name: serviceProvider }

  return { kind: 'unknown' }
}

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
  // an unknown purchase price renders „—", and 0 zł is a price someone chose.
  purchasePrice: numOrNull(raw.purchase_price),
  note: text(raw.note),
  location: toLocation(raw as LocationColumnsT),
  locatedAt: isoOrNull(raw.occurred_at),
  investmentName: text(raw.investment_name),
})

export const targetLabel = (target: EquipmentTargetT): string =>
  target.kind === 'service' ? `Serwis: ${target.name}` : target.name

export const toEquipmentEventRow = (raw: Record<string, unknown>): EquipmentEventRowT => ({
  id: Number(raw.id),
  occurredAt: text(isoOrNull(raw.occurred_at)),
  target: toLocation(raw as LocationColumnsT) as EquipmentTargetT,
  investmentName: text(raw.investment_name),
  cost: numOrNull(raw.cost),
  note: text(raw.note),
  createdByName: text(raw.created_by_name),
})
