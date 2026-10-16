export const sumKnown = (costs: readonly (number | null)[]): number | null => {
  if (costs.length > 0 && costs.every((cost) => cost === null)) return null

  return costs.reduce((total: number, cost) => total + (cost ?? 0), 0)
}
