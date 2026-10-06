export const RECEIPT_SCAN_MODES = ['one-invoice', 'one-per-photo'] as const
export type ScanModeT = (typeof RECEIPT_SCAN_MODES)[number]

// The product deliberately puts no cap on how many pages an invoice HAS; this caps how many go into
// one scan, and exists purely so the per-page budget in `lib/ai/openrouter.ts` stays inside the
// function's wall-clock limit: (30s + 15s × 7) × 2 attempts = 270s, under the 300s ceiling the route
// declares. Without it a caller could hand over 200 files and the platform would kill the invocation
// mid-flight, which reaches the user as an unparseable HTML 504 instead of the per-row failure path.
export const MAX_RECEIPT_PAGES = 8
