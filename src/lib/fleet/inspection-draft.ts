/**
 * Which draft slot „Nowy przegląd" writes into. The store keeps one slot per `formId`
 * (`create-form-store.ts`) and `useManagedForm` only restores a draft whose `formId` matches, so the
 * id IS the scope: opened from a vehicle page the dialog is locked to that car, and a shared id let
 * an abandoned draft follow the user to the next one. The fleet-wide dialog, where the car is still
 * a field, keeps the single unscoped slot.
 */
export function inspectionDraftId(vehicleId: number | undefined): string {
  return vehicleId ? `add-inspection-${vehicleId}` : 'add-inspection'
}
