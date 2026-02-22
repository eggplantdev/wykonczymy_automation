'use server'

import {
  createTransferSchema,
  type CreateTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { perf, perfStart } from '@/lib/perf'
import { isDepositType } from '@/lib/constants/transfers'
import config from '@payload-config'
import { getPayload } from 'payload'
import {
  getErrorMessage,
  validateAction,
  validateSourceRegister,
  checkIfSufficientBalance,
  handleInvoice,
  type ActionResultT,
} from './utils'

export async function createTransferAction(
  data: CreateTransferFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  console.log(`[PERF] createTransferAction START type=${data.type} amount=${data.amount}`)

  const session = await perf('createTransfer.requireAuth', () => requireAuth(MANAGEMENT_ROLES))
  if (!session.success) return session
  const { user } = session

  const parsed = validateAction(createTransferSchema, data)
  if (!parsed.success) return parsed

  try {
    const payload = await perf('createTransfer.getPayload', () => getPayload({ config }))

    // If not deposit, validate source register and check balance
    if (!isDepositType(parsed.data.type)) {
      const validated = await validateSourceRegister(data.sourceRegister, user)
      if (!validated.success) return validated

      const balanceCheck = await checkIfSufficientBalance(validated.register, data.amount, payload)
      if (!balanceCheck.success) return balanceCheck
    }

    const mediaId = invoiceFormData ? await handleInvoice(invoiceFormData, payload) : undefined

    await perf('createTransfer.payloadCreate (includes hooks)', async () => {
      await payload.create({
        collection: 'transactions',
        data: {
          ...data,
          description: data.description || '',
          invoice: mediaId,
          createdBy: user.id,
        },
      })
      revalidateCollections(['transfers', 'cashRegisters', 'investments'])
    })

    console.log(`[PERF] createTransferAction TOTAL ${elapsed()}ms`)

    return { success: true }
  } catch (err) {
    console.log('[createTransferAction] Error:', getErrorMessage(err))
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
    const mediaId = await handleInvoice(invoiceFormData, payload)

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
