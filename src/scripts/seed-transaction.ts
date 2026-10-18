import type { Payload } from 'payload'
import type { TransferTypeT } from '@/lib/constants/transfers'

export type TxnSeedT = {
  type: TransferTypeT
  amount: number
  investment: number
  description: string
  sourceRegister?: number
  expenseCategory?: number
}

// afterChange calls revalidateTag, which throws outside a Next request context; disableTransaction
// lets the insert survive it — balances are read-computed, so the lost revalidation is a no-op here.
export async function seedTransaction(payload: Payload, txn: TxnSeedT): Promise<void> {
  try {
    await payload.create({
      collection: 'transactions',
      disableTransaction: true,
      data: { ...txn, paymentMethod: 'TRANSFER', date: new Date().toISOString() },
      context: { skipRevalidation: true, skipSheetSync: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('static generation store')) throw error
  }
}
