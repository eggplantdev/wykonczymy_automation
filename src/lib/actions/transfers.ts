'use server'

import {
  createTransferSchema,
  type CreateTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { perf, perfStart } from '@/lib/perf'
import { uploadInvoiceFile } from '@/lib/upload-invoice'
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { isDepositType } from '../constants/transfers'
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
  console.log(`[PERF] createTransferAction START type=${data.type} amount=${data.amount}`)

  const session = await perf('createTransfer.requireAuth', () => requireAuth(MANAGEMENT_ROLES))
  if (!session.success) return session
  const { user } = session

  // Validate schena
  const parsed = validateAction(createTransferSchema, data)
  if (!parsed.success) return parsed

  let mediaId: number | undefined

  try {
    const payload = await perf('createTransfer.getPayload', () => getPayload({ config }))

    // If not deposit, validate source register
    if (!isDepositType(parsed.data.type)) {
      const validated = await validateSourceRegister(data.sourceRegister, user)
      if (!validated.success) return validated
      // and check if sufficient balance
      const balanceCheck = await checkIfSufficientBalance(validated.register, data.amount, payload)
      if (!balanceCheck.success) return balanceCheck
    }

    // Upload invoice file if provided
    if (invoiceFormData) mediaId = await uploadInvoice(invoiceFormData, payload)

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

async function uploadInvoice(
  invoiceFormData: FormData | null,
  payload: Payload,
): Promise<number | undefined> {
  const invoiceFile = invoiceFormData?.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0

  // Upload invoice file if provided
  let mediaId: number | undefined
  if (hasInvoice) {
    mediaId = await perf('createTransfer.uploadMedia', () =>
      uploadInvoiceFile(payload, invoiceFile),
    )
  }

  return mediaId
}

export async function updateTransferInvoiceAction(
  transferId: number,
  invoiceFormData: FormData,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    const mediaId = await uploadInvoice(invoiceFormData, payload)

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
