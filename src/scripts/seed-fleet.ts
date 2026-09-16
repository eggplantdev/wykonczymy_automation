// E2E fixture for flota (EX-716) — the one fact about the listing that only a browser can prove: a
// „Nie dotyczy (bezterminowo)" ticked on the vehicle form reaching the przegląd column on /flota.
//
// Two fresh vehicles per run, sharing one registration prefix, because the listing is GLOBAL — the
// test DB carries the whole prod fleet, so the spec narrows to these two through the search box and
// the „Razem" it then reads is a figure this seed alone answers for. The prefix carries the run's
// timestamp for the same reason the katalog seed does: the test DB is never reset, and `registration`
// is unique, so a stable one would collide on the second run.
//
// The costs vehicle carries two priced przeglądy of different types, so the „Koszty" column and the
// „Razem" footer have a figure this seed alone answers for.
// The exemption vehicle deliberately has NO przegląd techniczny at all: its cell reads „brak danych"
// until the form is ticked, which is what makes the change visible as „bezterminowo" rather than as
// a reshuffle of dates that were already there.
//
// Dates are fixed and long past, so no przegląd here ever falls due during a run.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-fleet.ts
//
// Emits one machine-readable line the spec parses:
//   FLEET_SEED={"prefix":"…","costs":{…},"exempt":{…}}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

const COST_TECHNICAL = 1500
const COST_OIL = 900

const PERFORMED_TECHNICAL = '2020-03-15'
const PERFORMED_OIL = '2019-03-15'

async function main() {
  const payload = await getPayload({ config })
  const stamp = Date.now()
  const prefix = `E2E${stamp}`

  const costs = await payload.create({
    collection: 'vehicles',
    data: {
      registration: `${prefix}K`,
      make: 'Ford',
      model: 'Transit',
      status: 'ACTIVE',
      exemptions: [],
    },
    ...ctx,
  })

  const exempt = await payload.create({
    collection: 'vehicles',
    data: {
      registration: `${prefix}Z`,
      make: 'Renault',
      model: 'Master',
      status: 'ACTIVE',
      exemptions: [],
    },
    ...ctx,
  })

  const inspections = [
    { type: 'TECHNICAL', performedAt: PERFORMED_TECHNICAL, cost: COST_TECHNICAL },
    { type: 'OIL_CHANGE', performedAt: PERFORMED_OIL, cost: COST_OIL },
  ] as const

  for (const inspection of inspections) {
    await payload.create({
      collection: 'vehicle-inspections',
      data: { vehicle: costs.id, ...inspection },
      ...ctx,
    })
  }

  const seed = {
    prefix,
    costs: { id: costs.id, registration: costs.registration },
    exempt: { id: exempt.id, registration: exempt.registration },
  }

  console.log(`FLEET_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
