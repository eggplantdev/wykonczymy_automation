'use server'

import { revalidatePath } from 'next/cache'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { isDepositType } from '@/lib/constants/transfers'
import {
  createTransferSchema,
  type CreateTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { sumRegisterBalance, sumInvestmentCosts } from '@/lib/db/sum-transfers'
import { uploadInvoiceFile } from '@/lib/media/upload-invoice'
import { perf, perfStart } from '@/lib/perf'
import { type ActionResultT, getErrorMessage, validateAction } from './utils'

type RecalculateResultT =
  | {
      success: true
      message: string
      results: {
        cashRegisters: { id: number; name: string; oldBalance: number; newBalance: number }[]
        investments: { id: number; name: string; oldCosts: number; newCosts: number }[]
      }
    }
  | { success: false; error: string }

export async function createTransferAction(
  data: CreateTransferFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  console.log(`[PERF] createTransferAction START type=${data.type} amount=${data.amount}`)

  const session = await perf('createTransfer.requireAuth', () => requireAuth(MANAGEMENT_ROLES))
  if (!session.success) return session
  const { user } = session

  // Validate
  const parsed = validateAction(createTransferSchema, data)
  if (!parsed.success) return parsed

  // Non-ADMIN users can only transfer from their own registers
  if (user.role !== 'ADMIN' && parsed.data.cashRegister) {
    const ownedIds = await getUserCashRegisterIds(user.id, user.role)
    if (ownedIds && !ownedIds.includes(parsed.data.cashRegister)) {
      return { success: false, error: 'Nie masz uprawnień do tej kasy' }
    }
  }

  const invoiceFile = invoiceFormData?.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0

  try {
    const payload = await perf('createTransfer.getPayload', () => getPayload({ config }))

    // Reject if transfer would cause negative balance on source register
    if (!isDepositType(parsed.data.type) && parsed.data.cashRegister) {
      const currentBalance = await perf('createTransfer.balanceCheck', () =>
        sumRegisterBalance(payload, parsed.data.cashRegister!),
      )

      if (currentBalance < parsed.data.amount) {
        return {
          success: false,
          error: `Niewystarczające saldo kasy (${currentBalance.toFixed(2)} zł). Najpierw dodaj środki.`,
        }
      }
    }

    // Upload invoice file if provided
    let mediaId: number | undefined
    if (hasInvoice) {
      mediaId = await perf('createTransfer.uploadMedia', () =>
        uploadInvoiceFile(payload, invoiceFile),
      )
    }

    // Create the transfer (hooks fire inside this call)
    const description = parsed.data.description || ''

    await perf('createTransfer.payloadCreate (includes hooks)', () =>
      payload.create({
        collection: 'transactions',
        data: {
          ...parsed.data,
          description,
          invoice: mediaId,
          createdBy: user.id,
        },
      }),
    )

    // Hook revalidates inside the DB transaction (row may not be visible yet).
    // Revalidate again after payload.create() returns (transaction committed).
    revalidateCollections(['transfers', 'cashRegisters', 'investments'])

    console.log(`[PERF] createTransferAction TOTAL ${elapsed()}ms`)

    return { success: true }
  } catch (err) {
    console.log('[createTransferAction] Error:', getErrorMessage(err))
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function recalculateBalancesAction(): Promise<RecalculateResultT> {
  const session = await requireAuth(['ADMIN', 'OWNER'])
  if (!session.success) return session

  const payload = await getPayload({ config })
  const results = {
    cashRegisters: [] as { id: number; name: string; oldBalance: number; newBalance: number }[],
    investments: [] as { id: number; name: string; oldCosts: number; newCosts: number }[],
  }

  const registers = await payload.find({ collection: 'cash-registers', pagination: false })
  for (const reg of registers.docs) {
    const newBalance = await sumRegisterBalance(payload, reg.id)
    const oldBalance = reg.balance ?? 0
    if (oldBalance !== newBalance) {
      await payload.update({
        collection: 'cash-registers',
        id: reg.id,
        data: { balance: newBalance },
        context: { skipBalanceRecalc: true },
        overrideAccess: true,
      })
      results.cashRegisters.push({ id: reg.id, name: reg.name, oldBalance, newBalance })
    }
  }

  const investments = await payload.find({ collection: 'investments', pagination: false })
  for (const inv of investments.docs) {
    const newCosts = await sumInvestmentCosts(payload, inv.id)
    const oldCosts = inv.totalCosts ?? 0
    if (oldCosts !== newCosts) {
      await payload.update({
        collection: 'investments',
        id: inv.id,
        data: { totalCosts: newCosts },
        context: { skipBalanceRecalc: true },
        overrideAccess: true,
      })
      results.investments.push({ id: inv.id, name: inv.name, oldCosts, newCosts })
    }
  }

  revalidateCollections(['transfers', 'cashRegisters', 'investments', 'users', 'otherCategories'])
  revalidatePath('/', 'layout')

  const fixed = results.cashRegisters.length + results.investments.length
  return {
    success: true,
    message: fixed === 0 ? 'Wszystkie salda są poprawne' : `Naprawiono ${fixed} sald`,
    results,
  }
}

export async function updateTransferNoteAction(
  transferId: number,
  note: string,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })

    await payload.update({
      collection: 'transactions',
      id: transferId,
      data: { invoiceNote: note },
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function updateTransferInvoiceAction(
  transferId: number,
  invoiceFormData: FormData,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  const invoiceFile = invoiceFormData.get('invoice') as File | null
  if (!invoiceFile || invoiceFile.size === 0) {
    return { success: false, error: 'Nie wybrano pliku' }
  }

  try {
    const payload = await getPayload({ config })

    const mediaId = await uploadInvoiceFile(payload, invoiceFile)

    await payload.update({
      collection: 'transactions',
      id: transferId,
      data: { invoice: mediaId },
    })

    revalidateCollections(['transfers'])

    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
