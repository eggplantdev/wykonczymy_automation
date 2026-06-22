// Test double for `@/lib/env`. The real module parses clientSchema at import, which would
// force every test that transitively pulls it in (e.g. via collections/users) to supply
// NEXT_PUBLIC_FRONTEND_URL. This passthrough reads process.env with a local fallback.
export const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000'
