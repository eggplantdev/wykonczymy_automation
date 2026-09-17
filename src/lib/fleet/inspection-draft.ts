/**
 * The store keeps one draft slot per `formId` and only restores a draft whose `formId` matches, so the
 * id IS the scope — a shared one let an abandoned draft follow the user to the next car. The
 * fleet-wide dialog, where the car is still a field, keeps the single unscoped slot.
 */
export function inspectionDraftId(vehicleId: number | undefined): string {
  return vehicleId ? `add-inspection-${vehicleId}` : 'add-inspection'
}
