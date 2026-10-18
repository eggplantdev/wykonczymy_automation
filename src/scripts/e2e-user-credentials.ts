// Kept payload-import-free so the Playwright
// process (global-setup, specs) can import them without pulling the Payload/Next graph.
export const E2E_EMAIL = 'e2e@wykonczymy.test'
export const E2E_PASSWORD = 'e2e-test-password-123'

export type E2ECredentialsT = { email: string; password: string }

export const E2E_OWNER: E2ECredentialsT = { email: E2E_EMAIL, password: E2E_PASSWORD }

const E2E_WORKER_PASSWORD = 'e2e-worker-password-123'

export const E2E_WORKERS = {
  self: { name: 'E2E Pracownik', email: 'e2e-worker@wykonczymy.test' },
  other: { name: 'E2E Pracownik Drugi', email: 'e2e-worker-other@wykonczymy.test' },
  credentials: { name: 'E2E Pracownik Dane', email: 'e2e-worker-credentials@wykonczymy.test' },
} as const

export const workerCredentials = (key: keyof typeof E2E_WORKERS): E2ECredentialsT => ({
  email: E2E_WORKERS[key].email,
  password: E2E_WORKER_PASSWORD,
})
