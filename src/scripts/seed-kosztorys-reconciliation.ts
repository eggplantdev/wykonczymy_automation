// E2E fixture for the kosztorys ↔ transactions reconciliation scream (EX-535). Seeds two fresh
// investments via the Payload Local API — one whose LABOR_COST/RABAT transactions DISAGREE with the
// kosztorys client-view figures (both surfaces must scream) and one where they AGREE (both silent).
//
// Deterministic and self-contained: unlike seed-kosztorys.ts it reads no Google Sheet. Each item has
// no discount, so „Suma prac wykonanych" (executed net, pre-rabat) = clientPrice × Σ qtyDone.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-kosztorys-reconciliation.ts
//
// Emits one machine-readable line the E2E spec parses:
//   RECON_SEED={"mismatch":<id>,"match":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

// A RABAT row needs a source register; register 5 exists in the standard dump (see e2e/helpers.ts).
const SOURCE_REGISTER_ID = 5
const CLIENT_PRICE = 100
const QTY_DONE = 5
const SUMA_PRAC_NET = CLIENT_PRICE * QTY_DONE // 500 — the „Suma prac wykonanych" both surfaces expect

const ctx = { context: { skipRevalidation: true } }

type SeededInvestment = { investmentId: number }

// Create an investment carrying one section / one stage / one no-discount item with recorded
// progress, so its executed „Suma prac wykonanych" is exactly SUMA_PRAC_NET.
async function seedKosztorys(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
): Promise<SeededInvestment> {
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23 },
    ...ctx,
  })
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: investment.id, ordinal: 1, label: 'Etap 1' },
    ...ctx,
  })
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: {
      investment: investment.id,
      name: 'Sekcja 1',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
    },
    ...ctx,
  })
  const item = await payload.create({
    collection: 'kosztorys-items',
    data: {
      investment: investment.id,
      section: section.id,
      displayOrder: 0,
      description: 'Pozycja 1',
      unit: 'm2',
      plannedQty: 10,
      discountValue: 0,
      clientPrice: CLIENT_PRICE,
      hiddenInExport: false,
    },
    ...ctx,
  })
  await payload.create({
    collection: 'stage-progress',
    data: { item: item.id, stage: stage.id, qtyDone: QTY_DONE },
    ...ctx,
  })
  return { investmentId: investment.id }
}

type TxnSeed = {
  type: 'LABOR_COST' | 'RABAT'
  amount: number
  investment: number
  description: string
  sourceRegister?: number
}

// The transaction afterChange balance hook calls revalidateTag, which throws outside a Next request
// context. disableTransaction lets the insert survive that throw; balances are read-computed, so the
// lost revalidation is a no-op in a script. (Same pattern as seed-inv31-expenses.ts.)
async function seedTransaction(
  payload: Awaited<ReturnType<typeof getPayload>>,
  txn: TxnSeed,
): Promise<void> {
  try {
    await payload.create({
      collection: 'transactions',
      disableTransaction: true,
      data: { ...txn, paymentMethod: 'TRANSFER', date: new Date().toISOString() },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('static generation store')) throw error
  }
}

async function main() {
  const payload = await getPayload({ config })
  // A per-run suffix keeps names unique — the test DB is not reset between runs, so a stable name
  // would collide. The spec only ever uses the IDs printed below, never the names.
  const stamp = Date.now()

  const mismatch = await seedKosztorys(payload, `E2E Recon mismatch ${stamp}`)
  // LABOR_COST ≠ SUMA_PRAC_NET → robocizna screams; RABAT > 0 while kosztorys rabat is 0 → rabat screams.
  await seedTransaction(payload, {
    type: 'LABOR_COST',
    amount: SUMA_PRAC_NET - 50,
    investment: mismatch.investmentId,
    description: 'E2E robocizna (niezgodna)',
  })
  await seedTransaction(payload, {
    type: 'RABAT',
    amount: 30,
    investment: mismatch.investmentId,
    sourceRegister: SOURCE_REGISTER_ID,
    description: 'E2E rabat (niezgodny)',
  })

  const match = await seedKosztorys(payload, `E2E Recon match ${stamp}`)
  // LABOR_COST == SUMA_PRAC_NET, and no RABAT (kosztorys rabat also 0) → both figures silent.
  await seedTransaction(payload, {
    type: 'LABOR_COST',
    amount: SUMA_PRAC_NET,
    investment: match.investmentId,
    description: 'E2E robocizna (zgodna)',
  })

  console.log(
    `RECON_SEED=${JSON.stringify({
      mismatch: mismatch.investmentId,
      match: match.investmentId,
      // The „Suma prac wykonanych" both surfaces must display for either investment.
      sumaPracNet: SUMA_PRAC_NET,
    })}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
