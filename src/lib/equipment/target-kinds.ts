/**
 * What a handover can point at. Mirrors `EquipmentTargetT`'s three kinds — the union describes a
 * stored row, this describes the CHOICE a form offers before the row exists.
 */
export const EQUIPMENT_TARGET_KINDS = ['holder', 'warehouse', 'service'] as const

export type EquipmentTargetKindT = (typeof EQUIPMENT_TARGET_KINDS)[number]

export const EQUIPMENT_TARGET_KIND_LABELS: Record<EquipmentTargetKindT, string> = {
  holder: 'Pracownik',
  warehouse: 'Magazyn',
  service: 'Serwis',
}
