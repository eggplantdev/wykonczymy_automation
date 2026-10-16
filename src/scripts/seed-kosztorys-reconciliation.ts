import { getPayload } from 'payload'
import config from '../payload.config'

const SOURCE_REGISTER_ID = 5
const CLIENT_PRICE = 100
const QTY_DONE = 5
const LABOR_COSTS_NET = CLIENT_PRICE * QTY_DONE

const ctx = { context: { skipRevalidation: true } }

type SeededInvestment = { investmentId: number; name: string }

async function seedKosztorys(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
): Promise<SeededInvestment> {
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    // `plane` must be set — a plane-less etap renders ilość read-only (kosztorys-v2-columns.tsx).
    data: {
      splitMode: 'percent',
      investment: investment.id,
      ordinal: 1,
      label: 'Etap 1',
      plane: 'w_tools',
    },
    ...ctx,
  })
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: {
      investment: investment.id,
      name: 'Sekcja 1',
      displayOrder: 0,
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
    },
    ...ctx,
  })
  await payload.create({
    collection: 'stage-progress',
    data: { item: item.id, stage: stage.id, qtyDone: QTY_DONE },
    ...ctx,
  })
  return { investmentId: investment.id, name }
}

type TxnSeed = {
  type: 'LABOR_COST' | 'RABAT'
  amount: number
  investment: number
  description: string
  sourceRegister?: number
}

// The transaction afterChange balance hook calls revalidateTag, which throws outside a Next request
// context. disableTransaction lets the insert survive that throw.
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
  // would collide.
  const stamp = Date.now()

  const mismatch = await seedKosztorys(payload, `E2E Recon mismatch ${stamp}`)
  await seedTransaction(payload, {
    type: 'LABOR_COST',
    amount: LABOR_COSTS_NET - 50,
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
  await seedTransaction(payload, {
    type: 'LABOR_COST',
    amount: LABOR_COSTS_NET,
    investment: match.investmentId,
    description: 'E2E robocizna (zgodna)',
  })

  console.log(
    `RECON_SEED=${JSON.stringify({
      mismatch: mismatch.investmentId,
      match: match.investmentId,
      matchName: match.name,
      laborCostsNetFromKosztorys: LABOR_COSTS_NET,
    })}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
