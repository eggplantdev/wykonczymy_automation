// Creates the case's investment on the LOCAL DB, kosztorys seeded from szablon PRESET_ID.
// SOURCE_JSON stays outside the repo — it carries the client's contacts and the e-mail as notes.
// Not `createInvestment`: its create runs the revalidate hook (revalidateTag throws outside Next),
// and its seed reads the szablon through `getKosztorysTree`, which needs a session. The seed below
// is `seedInvestmentFromPreset` with the auth-free `buildKosztorysTree` read; the strip mirrors
// `serializeKosztorysAsPreset`. INV=<id> seeds an existing empty investment instead of creating one.
// Restart dev afterwards so the cached listing picks the row up.
//   SOURCE_JSON=… [PRESET_ID=165] [INV=…] node --env-file=.env --conditions=react-server --import tsx \
//     context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/create-case-local.ts
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { applyPreset } from '@/lib/kosztorys/apply-preset'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { assertLocalDb } from '@/scripts/assert-local-db'

const PRESET_ID = Number(process.env.PRESET_ID ?? 165)
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

  await withPayloadTransaction(
    payload,
    async (req) => {
      const { globalDiscount: _globalDiscount, ...snapshot } = serializeTree(
        await buildKosztorysTree(PRESET_ID, req),
      )
      await applyPreset(payload, req, investmentId, {
        ...snapshot,
        items: snapshot.items.map(({ ref: _ref, ...item }) => ({
          ...item,
          plannedQty: 0,
          currentPlannedQty: null,
          sheetMeasuredQty: null,
          discountType: null,
          discountValue: 0,
          note: null,
          aiPlannedQty: null,
          changeReason: null,
          reviewStatus: null,
        })),
        stages: [],
        progress: [],
      })
    },
    { skipRevalidation: true },
  )
  console.log(`investment #${investmentId}, seeded from szablon #${PRESET_ID}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
