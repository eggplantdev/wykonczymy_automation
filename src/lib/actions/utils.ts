import type { ZodType, ZodError } from 'zod'
import type { Payload } from 'payload'
import { perf } from '@/lib/perf'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { uploadInvoiceFile } from '@/lib/upload-invoice'
import type { SessionUserT } from '@/types/auth'
import type { ReferenceItemT } from '@/types/reference-data'

export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: TData } | { success: false; error: string }

export type ValidateSourceRegisterResultT =
  | { success: true; register: ReferenceItemT }
  | { success: false; error: string }

const DEFAULT_ERROR = 'Wystąpił błąd'

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : DEFAULT_ERROR
}

const firstZodError = (error: ZodError): string => error.issues[0]?.message ?? DEFAULT_ERROR

export function validateAction<TData>(
  schema: ZodType<TData>,
  data: unknown,
): { success: true; data: TData } | { success: false; error: string } {
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { success: false, error: firstZodError(parsed.error) }
  return { success: true, data: parsed.data }
}

/** Checks that the register exists and the user has ownership rights to it. */
export async function validateSourceRegister(
  cashRegisterId: number | undefined,
  user: SessionUserT,
): Promise<ValidateSourceRegisterResultT> {
  const refData = await perf('action.refData', () => fetchReferenceData())
  const register = refData.cashRegisters.find((cr) => cr.id === cashRegisterId)

  if (!register) return { success: false, error: 'Kasa nie istnieje' }

  // admin can transfer from any register other roles can only transfer from their own register
  if (user.role !== 'ADMIN' && register.ownerId !== user.id) {
    return { success: false, error: 'Nie masz uprawnień do tej kasy' }
  }

  return { success: true, register }
}

/** Verifies the register has enough balance for the withdrawal. Skips virtual registers. */
export async function checkIfSufficientBalance(
  register: ReferenceItemT,
  amount: number,
  payload: Payload,
): Promise<ActionResultT> {
  if (register.type === 'VIRTUAL') return { success: true }

  const currentBalance = await perf('action.balanceCheck', () =>
    sumRegisterBalance(payload, register.id),
  )

  if (currentBalance > amount) return { success: true }

  return {
    success: false,
    error: `Niewystarczające saldo kasy (${currentBalance.toFixed(2)} zł). Najpierw dodaj środki.`,
  }
}

export async function handleInvoice(
  invoiceFormData: FormData | null,
  payload: Payload,
): Promise<number | undefined> {
  const invoiceFile = invoiceFormData?.get('invoice') as File | null
  if (!invoiceFile || invoiceFile.size === 0) return undefined

  return perf('action.uploadMedia', () => uploadInvoiceFile(payload, invoiceFile))
}
