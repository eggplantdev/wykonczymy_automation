// Test stub for the `server-only` package. Vitest runs in a Node env without the
// `react-server` export condition, so the real package resolves to its throwing entry.
// Aliased here (vitest.config.ts) to a no-op so server modules under test can import it.
export {}
