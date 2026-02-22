'use server'

import {
  createTransferSchema,
  type CreateTransferFormT,
  createBulkTransferSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { perfStart } from '@/lib/perf'
import { uploadBulkInvoices, uploadSingleInvoice } from '@/lib/upload-invoice'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isDepositType, needsSourceRegister } from '../constants/transfers'
import {
  checkIfSufficientBalance,
  getErrorMessage,
  validateAction,
  validateSourceRegister,
  type ActionResultT,
} from './utils'

export async function createTransferAction(
  data: CreateTransferFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session
  const { user } = session

  const parsed = validateAction(createTransferSchema, data)
  if (!parsed.success) return parsed

  let mediaId: number | undefined

  try {
    const payload = await getPayload({ config })

    // If not deposit, validate source register
    if (!isDepositType(parsed.data.type)) {
      const validated = await validateSourceRegister(data.sourceRegister, user)
      if (!validated.success) return validated
      // and check if sufficient balance
      const balanceCheck = await checkIfSufficientBalance(validated.register, data.amount, payload)
      if (!balanceCheck.success) return balanceCheck
    }

    // Upload invoice file if provided
    if (invoiceFormData) mediaId = await uploadSingleInvoice(payload, invoiceFormData)

    await payload.create({
      collection: 'transactions',
      data: {
        ...data,
        description: data.description || '',
        invoice: mediaId,
        createdBy: user.id,
      },
    })

    revalidateCollections(['transfers'])

    console.log(`[PERF] createTransferAction ${elapsed()}ms type=${data.type}`)

    return { success: true }
  } catch (err) {
    console.log('[createTransferAction] Error:', getErrorMessage(err))
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function createBulkTransferAction(
  data: CreateBulkTransferFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  const lineCount = data.lineItems.length

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session
  const { user } = session

  const parsed = validateAction(createBulkTransferSchema, data)
  if (!parsed.success) return parsed

  try {
    const payload = await getPayload({ config })

    // Validate source register + balance check (sum of all line items)
    if (needsSourceRegister(parsed.data.type)) {
      const validated = await validateSourceRegister(parsed.data.sourceRegister, user)
      if (!validated.success) return validated

      const totalAmount = parsed.data.lineItems.reduce((sum, item) => sum + item.amount, 0)
      const balanceCheck = await checkIfSufficientBalance(validated.register, totalAmount, payload)
      if (!balanceCheck.success) return balanceCheck
    }

    // Upload invoice files in parallel
    const mediaIds = await uploadBulkInvoices(payload, invoiceFormData, lineCount)

    // Create all transactions in parallel — hook handles cache revalidation
    await Promise.all(
      parsed.data.lineItems.map((item, i) =>
        payload.create({
          collection: 'transactions',
          data: {
            description: item.description,
            amount: item.amount,
            date: parsed.data.date,
            type: parsed.data.type,
            paymentMethod: parsed.data.paymentMethod,
            sourceRegister: parsed.data.sourceRegister,
            targetRegister: parsed.data.targetRegister,
            investment: parsed.data.investment,
            worker: parsed.data.worker,
            otherCategory: parsed.data.otherCategory,
            otherDescription: parsed.data.otherDescription,
            invoice: mediaIds[i],
            invoiceNote: item.invoiceNote,
            createdBy: user.id,
          },
        }),
      ),
    )

    revalidateCollections(['transfers'])

    console.log(
      `[PERF] createBulkTransferAction ${elapsed()}ms type=${data.type} items=${lineCount}`,
    )

    return { success: true }
  } catch (err) {
    console.log('[createBulkTransferAction] Error:', getErrorMessage(err))
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function cancelTransferAction(transferId: number): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session
  const { user } = session

  try {
    const payload = await getPayload({ config })

    const original = await payload.findByID({
      collection: 'transactions',
      id: transferId,
      depth: 0,
    })

    if (!original) return { success: false, error: 'Transakcja nie istnieje.' }
    if (original.cancelled) return { success: false, error: 'Transakcja jest już anulowana.' }

    // Only creator or admin/owner can cancel
    const creatorId =
      typeof original.createdBy === 'number' ? original.createdBy : original.createdBy?.id
    if (user.id !== creatorId && !isAdminOrOwnerRole(user.role)) {
      return { success: false, error: 'Nie masz uprawnień do anulowania tej transakcji.' }
    }

    // Mark original as cancelled (triggers recalcAfterChange hook → balance recalculates)
    await payload.update({
      collection: 'transactions',
      id: transferId,
      data: { cancelled: true },
    })

    // Create CANCELLATION audit row
    const today = new Date().toISOString().split('T')[0]
    await payload.create({
      collection: 'transactions',
      data: {
        type: 'CANCELLATION',
        amount: original.amount,
        date: today,
        description: `Anulowanie transakcji #${transferId}`,
        paymentMethod: original.paymentMethod,
        cancelledTransaction: transferId,
        createdBy: user.id,
      },
    })

    revalidateCollections(['transfers'])

    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
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

  try {
    const payload = await getPayload({ config })
    const mediaId = await uploadSingleInvoice(payload, invoiceFormData)

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
