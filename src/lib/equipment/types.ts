import type { EquipmentStatusT } from './equipment-status'

export type EquipmentTargetT =
  | { kind: 'holder'; id: number; name: string }
  | { kind: 'warehouse'; id: number; name: string }
  | { kind: 'service'; name: string }

export type EquipmentLocationT = EquipmentTargetT | { kind: 'unknown' }

export type EquipmentRowT = {
  id: number
  name: string
  serialNumber: string
  make: string
  model: string
  status: EquipmentStatusT
  purchaseDate: string | null
  warrantyUntil: string | null
  purchasePrice: number | null
  note: string
  location: EquipmentLocationT
  /** The day the item got where it is — the newest event's `occurredAt`, not its creation date. */
  locatedAt: string | null
  investmentName: string
}

export type EquipmentEventRowT = {
  id: number
  occurredAt: string
  target: EquipmentTargetT
  investmentName: string
  cost: number | null
  note: string
  /** Empty on rows written before the column existed. */
  createdByName: string
}

/** People AND warehouses, despite the name */
export type WarehouseOptionT = { id: number; name: string }

export type EquipmentDetailT = {
  equipment: EquipmentRowT
  history: EquipmentEventRowT[]
}

export type EquipmentWarrantyRowT = {
  id: number
  name: string
  make: string
  model: string
  serialNumber: string
  status: EquipmentStatusT
  warrantyUntil: string | null
  warrantyNotifiedBucket: number | null
}
