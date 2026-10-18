// Rows the restored test dump carries. Payload-import-free for the same reason as
// `e2e-user-credentials.ts`: the Playwright drivers import them too.
export const EXPENSE_REGISTER = { id: 5, name: 'Kasa główna Bartek' }
export const EXPENSE_INVESTMENT = 'Plac Hallera 6'
export const EXPENSE_CATEGORY = 'Materiały budowlane'
// No other spec books against it, and investment-lock always hands it back active.
export const LOCKED_INVESTMENT = { id: 124, name: 'Agnieszka Zochowska ul. Człuchowska' }
// Dump rows rather than seeded ones because `kosztorys_v2` resolves the investment off
// `fetchReferenceData`, whose cache no seed script can invalidate from outside the server process,
// so a freshly created investment 404s there. The control needs a KOSZTORYS: with none, v2 reads
// 0 zł and „no strata step" would pass on a page that renders no steps whatsoever.
export const LOSS_INVESTMENT = { id: 137, name: 'testowe inwestycje' }
export const CLEAN_INVESTMENT = { id: 106, name: 'Sulmierzycka 6/29 - poprawki' }
