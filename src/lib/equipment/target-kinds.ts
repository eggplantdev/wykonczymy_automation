export const EQUIPMENT_TARGET_KINDS = ['holder', 'warehouse', 'service'] as const

export type EquipmentTargetKindT = (typeof EQUIPMENT_TARGET_KINDS)[number]

export const EQUIPMENT_TARGET_KIND_LABELS: Record<EquipmentTargetKindT, string> = {
  holder: 'Pracownik',
  warehouse: 'Magazyn',
  service: 'Serwis',
}
