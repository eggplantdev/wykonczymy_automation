// Creates the case's investment on the LOCAL DB, kosztorys seeded from szablon PRESET_ID.
// SOURCE_JSON stays outside the repo — it carries the client's contacts and the e-mail as notes.
// Not `createInvestment`: its create runs the revalidate hook (revalidateTag throws outside Next).
// The seed is `seedInvestmentFromPreset` itself, which needs no session. INV=<id> seeds an existing
// empty investment instead of creating one.
// Restart dev afterwards so the cached listing picks the row up.
//   SOURCE_JSON=… PRESET_ID=<szablon id> [INV=…] node --env-file=.env --conditions=react-server --import tsx \
//     context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/create-case-local.ts
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import { assertLocalDb } from '@/scripts/assert-local-db'

// A szablon is a `templates` row: its id is not the id of the investment it was before EX-1075.
const PRESET_ID = Number(process.env.PRESET_ID)
if (!PRESET_ID) throw new Error('PRESET_ID=<szablon id> is required')
assertLocalDb('create-case-local')

async function run() {
  const payload = await getPayload({ config })
  const investmentId = process.env.INV
    ? Number(process.env.INV)
    : Number(
        (
          await payload.create({
            collection: 'investments',
            data: {
              ...JSON.parse(readFileSync(process.env.SOURCE_JSON ?? '', 'utf8')),
              reviewRequested: false,
              status: 'quote',
              settlementMode: SETTLEMENT_MODE_DEFAULT,
            },
            context: { skipRevalidation: true },
          })
        ).id,
      )

  const seeded = await seedInvestmentFromPreset(payload, investmentId, PRESET_ID)
  if (seeded !== 'ok') throw new Error(`seed from szablon #${PRESET_ID}: ${seeded}`)
  console.log(`investment #${investmentId}, seeded from szablon #${PRESET_ID}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
