// Credentials for the seeded E2E OWNER user. Kept payload-import-free so the Playwright
// process (global-setup, specs) can import them without pulling the Payload/Next graph —
// importing the seeder itself drags in next/cache, which Playwright's loader can't resolve.
export const E2E_EMAIL = 'e2e@wykonczymy.test'
export const E2E_PASSWORD = 'e2e-test-password-123'
