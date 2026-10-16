export type ScanModeT = 'one-invoice' | 'one-per-photo'

// exists so the per-page budget in `lib/ai/openrouter.ts` stays inside the
// function's wall-clock limit: (30s + 15s × 7) × 2 attempts = 270s, under the 300s ceiling the route
// declares.
export const MAX_RECEIPT_PAGES = 8
