import type { EquipmentStatusT } from './equipment-status'

/**
 * Where one item is right now — always derived from the newest event, never stored on the item.
 *
 * `unknown` is the answer for an item with no history at all, and it is a real answer rather than a
 * missing one: the register accepts an item before anyone hands it anywhere. What separates a gap
 * from a fact is the item's STATUS, not this union — see `isLiveStatus`.
 */
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
  /** What it was last taken for. Belongs to the newest event, so it expires with the next handover. */
  investmentName: string
}

export type EquipmentEventRowT = {
  id: number
  occurredAt: string
  /** Never `unknown`: every event carries exactly one target (`hooks/equipment/validate.ts`). */
  target: EquipmentTargetT
  investmentName: string
  cost: number | null
  note: string
  /** Who recorded the event. Empty on rows written before the column existed — see 20260904_0. */
  createdByName: string
}

/** People AND warehouses, despite the name — both halves of the „gdzie jest" dropdown. */
export type WarehouseOptionT = { id: number; name: string }

export type EquipmentDetailT = {
  equipment: EquipmentRowT
  history: EquipmentEventRowT[]
}

/**
 * What the warranty sweep reads. A slice of the item rather than `EquipmentRowT`, because the sweep
 * needs the bookkeeping columns the listing must never show and none of the location joins.
 */
export type EquipmentWarrantyRowT = {
  id: number
  name: string
  make: string
  model: string
  serialNumber: string
  status: EquipmentStatusT
  warrantyUntil: string | null
  /** The bucket already announced, or `null` when this warranty has never mailed. */
  warrantyNotifiedBucket: number | null
}
