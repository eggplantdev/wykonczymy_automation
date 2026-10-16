export function inspectionDraftId(vehicleId: number | undefined): string {
  return vehicleId ? `add-inspection-${vehicleId}` : 'add-inspection'
}
