'use server'

import type { Payload } from 'payload'
import type { Transaction } from '@/payload-types'
import {
  createBulkExpenseSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/bulk-expense-schema'
import { canMutateTransfer } from '@/lib/auth/roles'
import { canBeSettled } from '@/lib/constants/transfers'
import { perfStart } from '@/lib/perf'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  cancelTransferSchema,
  createTransferSchema,
  updateTransferSchema,
  type CancelTransferFormT,
  type CreateTransferFormT,
  type UpdateTransferFormT,
} from '@/lib/schemas/transfer'
import type { SessionUserT } from '@/types/auth'
import { after } from 'next/server'
import { canFillVatPlane, isLaborCost, needsSourceRegister } from '../constants/transfers'
import { syncBulkExpensesToSheet } from './sheets-sync'
import { validateAction, protectedAction } from './run-action'
import { validateSourceRegister } from './validate-source-register'
import { getNetAmountError } from '@/lib/utils/validation'
import { logError } from '@/lib/utils/log-error'
import { resolveId } from '@/lib/utils/resolve-id'
import { invoiceIds } from '@/lib/invoices/invoice-field'
import { deleteUnreferencedMedia } from '@/lib/invoices/delete-unreferenced-media'
import type { ActionResultT } from '@/types/action'
import { getDb } from '@/lib/db/get-db'
import { isRelatedInvestmentLocked } from '@/lib/db/investment-lock'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

export async function createTransferAction(data: CreateTransferFormT, invoiceMediaIds?: number[]) {
  return protectedAction(
    `createTransferAction type=${data.type}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      if (needsSourceRegister(parsed.data.type)) {
        // For deposits, sourceRegister is actually the target (the register receiving money)
        const validated = await validateSourceRegister(parsed.data.sourceRegister, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated
      }

      // The gate itself is the collection hook, which covers the API and the panel too; here only so
      // the refusal reaches the form as a sentence instead of a raw hook Error.
      if (await isRelatedInvestmentLocked(await getDb(payload), parsed.data.investment)) {
        return { success: false, error: INVESTMENT_LOCKED_MESSAGE }
      }

      await payload.create({
        collection: 'transactions',
        data: {
          // `parsed.data`, never the raw input: the schema is what narrows a client payload down to
          // the fields a transfer may carry, and spreading the input again hands that narrowing back.
          ...parsed.data,
          description: parsed.data.description || '',
          invoice: invoiceMediaIds?.length ? invoiceMediaIds : undefined,
          createdBy: user.id,
        },
      })
      console.log(`[PERF]   payload.create ${step()}ms`)

      return { success: true }
    },
    ['transfers'],
  )
}

export async function createBulkTransferAction(
  data: CreateBulkExpenseFormT,
  invoiceMediaIds?: number[][],
) {
  const lineCount = data.lineItems.length

  return protectedAction(
    `createBulkTransferAction type=${data.type} items=${lineCount}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createBulkExpenseSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      if (needsSourceRegister(parsed.data.type)) {
        // For deposits, sourceRegister is actually the target (the register receiving money)
        const validated = await validateSourceRegister(parsed.data.sourceRegister, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated
      }

      if (await isRelatedInvestmentLocked(await getDb(payload), parsed.data.investment)) {
        return { success: false, error: INVESTMENT_LOCKED_MESSAGE }
      }

      // skipSheetSync: the per-row afterChange hook must NOT sync each created
      // row one-by-one — this action batches them all in a single sheet write below
      // (review T4.2). The flag rides on req.context, which Payload passes to hooks.
      const createdIds = await withPayloadTransaction(
        payload,
        async (req) => {
          const ids: number[] = []
          for (let i = 0; i < parsed.data.lineItems.length; i++) {
            const item = parsed.data.lineItems[i]
            const invoicePages = invoiceMediaIds?.[i]
            const created = await payload.create({
              collection: 'transactions',
              req,
              data: {
                description: item.description,
                amount: item.amount,
                netAmount: item.netAmount,
                date: parsed.data.date,
                type: parsed.data.type,
                paymentMethod: parsed.data.paymentMethod,
                sourceRegister: parsed.data.sourceRegister,
                targetRegister: parsed.data.targetRegister,
                investment: parsed.data.investment,
                worker: parsed.data.worker,
                expenseCategory: item.expenseCategory,
                otherCategory: item.category,
                invoice: invoicePages?.length ? invoicePages : undefined,
                invoiceNote: item.invoiceNote,
                settled: canBeSettled(parsed.data.type) && parsed.data.settled === true,
                createdBy: user.id,
              },
            })
            ids.push(created.id)
          }
          return ids
        },
        { skipSheetSync: true },
      )
      console.log(`[PERF]   payload.create x${lineCount} ${step()}ms`)

      // Post-response sync after commit — never before, else a rolled-back row would
      // leak into the sheet. One batched call for all created rows (read the sheet
      // once, write once) instead of N serialized single-transfer syncs (review T4.2).
      // `after()` keeps the function alive past the response on Vercel.
      after(() => syncBulkExpensesToSheet(createdIds))

      return { success: true }
    },
    ['transfers'],
  )
}

type AuthErrorT = { error: string }
type AuthSuccessT = { original: Transaction }

async function fetchAndAuthorize(
  payload: Payload,
  user: SessionUserT,
  transferId: number,
  errorVerb: string,
): Promise<AuthErrorT | AuthSuccessT> {
  const original = await payload.findByID({
    collection: 'transactions',
    id: transferId,
    depth: 0,
  })

  if (!original) return { error: 'Transakcja nie istnieje.' }
  if (original.cancelled) return { error: 'Transakcja jest już anulowana.' }
  if (original.type === 'CANCELLATION') return { error: 'Nie można edytować anulowania.' }
  if (await isRelatedInvestmentLocked(await getDb(payload), original.investment)) {
    return { error: INVESTMENT_LOCKED_MESSAGE }
  }

  const creatorId = resolveId(original.createdBy)
  const allowed = canMutateTransfer({
    role: user.role,
    userId: user.id,
    transferType: original.type,
    createdById: creatorId,
  })
  if (!allowed) {
    return { error: `Nie masz uprawnień do ${errorVerb} tej transakcji.` }
  }

  return { original }
}

export async function cancelTransferAction(transferId: number, data: CancelTransferFormT) {
  return protectedAction(
    'cancelTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(cancelTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      const result = await fetchAndAuthorize(payload, user, transferId, 'anulowania')
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      if ('error' in result) return { success: false, error: result.error }
      const { original } = result

      // Mark original as cancelled (triggers recalcAfterChange hook)
      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { cancelled: true },
      })
      console.log(`[PERF]   update cancelled ${step()}ms`)

      // Create CANCELLATION audit row
      const today = new Date().toISOString().split('T')[0]
      await payload.create({
        collection: 'transactions',
        data: {
          type: 'CANCELLATION',
          amount: original.amount,
          date: today,
          description: `Anulowanie transakcji #${transferId}\n${parsed.data.reason}`,
          cancelledTransaction: transferId,
          createdBy: user.id,
        },
      })
      console.log(`[PERF]   create CANCELLATION ${step()}ms`)

      // The kosztorys sheet row is removed by the collection afterChange hook, which
      // fires on the `cancelled: true` update above (review T2.2) — no action-level
      // sync here, or it would double the work.

      return { success: true }
    },
    ['transfers'],
  )
}

export async function updateTransferAction(
  transferId: number,
  data: UpdateTransferFormT,
  invoiceMediaIds?: number[],
) {
  return protectedAction(
    'updateTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(updateTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      const result = await fetchAndAuthorize(payload, user, transferId, 'edycji')
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      if ('error' in result) return { success: false, error: result.error }
      const { original } = result

      // Only LABOR_COST transfers can have their amount edited
      const { amount, vatPlane, netAmount, ...fields } = parsed.data
      const newAmount = isLaborCost(original.type) ? amount : undefined
      const amountChanged = newAmount !== undefined && newAmount !== original.amount

      // Narrower than write-once (that is the hook's): whether the edit gets to state a plane at
      // all, so a booked row's answer is dropped before the write rather than refused by it.
      const fillsPlane = vatPlane !== undefined && canFillVatPlane(original)
      if (fillsPlane) {
        // The hook runs this too — called early so a bad kwota is refused before the write.
        const netErr = getNetAmountError(netAmount, original.amount, original.type, vatPlane)
        if (netErr) return { success: false, error: netErr }
      }

      // Moving a zaliczka to another investment orphans its etap tag; the collection's
      // beforeValidate hook clears it, so every write path is covered, not just this action.

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: {
          ...fields,
          ...(newAmount !== undefined && { amount: newAmount }),
          ...(fillsPlane && { vatPlane, netAmount: netAmount ?? null }),
          // Newly picked files are extra pages of the same invoice, so they append — an edit that
          // replaced the list would strand the pages the user never touched.
          ...(invoiceMediaIds?.length && {
            invoice: [...invoiceIds(original.invoice), ...invoiceMediaIds],
          }),
          updatedBy: user.id,
        },
      })

      if (amountChanged) {
        await payload.create({
          collection: 'amount-edits',
          data: {
            transaction: transferId,
            previousAmount: original.amount,
            newAmount,
            editedBy: user.id,
          },
        })
      }
      console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

      // Materiały sheet sync (including the move-to-another-investment case) runs from
      // the collection afterChange hook, which compares previousDoc/doc from the DB —
      // so it's correct even when the edit omits the investment field (review T2.2 +
      // closes T2.3), and it covers admin-panel edits. No action-level sync here.

      return { success: true }
    },
    ['transfers'],
  )
}

/**
 * Rewrite a transfer's invoice pages to whatever `nextIds` derives from the current list, then
 * delete the media the new list dropped once nothing else references it.
 *
 * Deliberately does NOT go through `fetchAndAuthorize` (owner, 2026-08-10): attaching and
 * detaching invoice pages is open to every management session regardless of who created the
 * transfer, exactly as it was before the pages became a list.
 */
async function setTransferInvoices(
  payload: Payload,
  transferId: number,
  nextIds: (currentIds: number[]) => number[],
): Promise<ActionResultT> {
  const step = perfStart()

  const transfer = await payload.findByID({ collection: 'transactions', id: transferId, depth: 0 })
  const currentIds = invoiceIds(transfer.invoice)
  const next = nextIds(currentIds)
  console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

  await payload.update({
    collection: 'transactions',
    id: transferId,
    data: { invoice: next },
  })
  console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

  // Awaited, not fire-and-forget: the serverless invocation can be frozen the moment the response
  // is written, which would drop the deletes and leak exactly the files this is here to reclaim.
  await deleteUnreferencedMedia(
    payload,
    currentIds.filter((id) => !next.includes(id)),
  )

  return { success: true }
}

/**
 * Takes the whole batch because `setTransferInvoices` is a read-modify-write — one call per page
 * would race, and every page but the last would be lost.
 */
export async function addTransferInvoicesAction(
  transferId: number,
  invoiceMediaIds: number[],
): Promise<ActionResultT> {
  return protectedAction(
    'addTransferInvoicesAction',
    async ({ payload }) => {
      // Inside the auth boundary, not before it: a `{ success: true }` returned without one would
      // read as "authorized" to the next caller.
      if (invoiceMediaIds.length === 0) return { success: true }

      return setTransferInvoices(payload, transferId, (current) => {
        const next = [...current]
        invoiceMediaIds.forEach((id) => {
          if (!next.includes(id)) next.push(id)
        })
        return next
      })
    },
    ['transfers'],
  )
}

/** Removes one page, leaving the rest in order. */
export async function removeTransferInvoiceAction(transferId: number, invoiceMediaId: number) {
  return protectedAction(
    'removeTransferInvoiceAction',
    ({ payload }) =>
      setTransferInvoices(payload, transferId, (current) =>
        current.filter((id) => id !== invoiceMediaId),
      ),
    ['transfers'],
  )
}

/** Removes every page — the whole invoice, not one of its photos. */
export async function removeAllTransferInvoicesAction(transferId: number) {
  return protectedAction(
    'removeAllTransferInvoicesAction',
    ({ payload }) => setTransferInvoices(payload, transferId, () => []),
    ['transfers'],
  )
}
