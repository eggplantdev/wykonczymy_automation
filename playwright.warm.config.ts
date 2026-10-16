import base from './playwright.config'

// The specs write through whatever DB that server holds, and the seeds cannot
// stop them: globalSetup pins ITS OWN connection to `DB_POSTGRES_URL_TEST`, so a server started
// against the 5433 dev DB produces a run that seeds the test DB and then mutates — and deletes —
// real local data, with every assertion still green.
export default {
  ...base,
  webServer: {
    command: 'true', // no-op: the server is already up; reuse it
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 5_000,
  },
}
