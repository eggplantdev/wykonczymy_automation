// Default subcontractor markup coefficients for an investment — the single source for both the
// Payload column `defaultValue` (src/collections/investments.ts) and the query fallback
// (src/lib/queries/kosztorys.ts). A section or item may override them.
export const DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.55 } as const
