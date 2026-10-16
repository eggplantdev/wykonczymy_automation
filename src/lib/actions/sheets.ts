'use server'

import type { Payload } from 'payload'
import { applyMaterialSync } from '@/lib/actions/sheets-sync'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { extractSheetId, verifySheetAccess } from '@/lib/google/sheet-access'
import { writeServiceAccountEmail } from '@/lib/google/auth'
import { stampAllTabs } from '@/lib/google/app-managed-tabs'
import { getInvestmentSheet, MISSING_SHEET } from '@/lib/google/sheet-lookup'
import { isColumnField } from '@/lib/kosztorys/sheet-import/columns'
import { isPointableColumn } from '@/lib/kosztorys/sheet-import/sheet-column-mapping'
import { investmentAction } from '@/lib/actions/investment-action'
import { getDb } from '@/lib/db/get-db'
import { relatedInvestmentLockMessage } from '@/lib/db/investment-gate'
import { protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'

export async function addUnlinkedSheetAction(input: string, name?: string) {
  return protectedAction<{ sheetId: number; name: string }>(
    'addUnlinkedSheetAction',
    async ({ payload }) => {
      const googleSheetId = extractSheetId(input)
      if (!googleSheetId) {
        return { success: false, error: 'Nieprawidłowy link lub identyfikator arkusza Google.' }
      }

      const existing = await payload.find({
        collection: 'kosztoryses',
        where: { googleSheetId: { equals: googleSheetId } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        return {
          success: false,
          error: 'Ten arkusz jest już zarejestrowany w aplikacji jako kosztorys.',
        }
      }

      const access = await verifySheetAccess(googleSheetId)
      if (!access) {
        return {
          success: false,
          error:
            'Nie można otworzyć tego arkusza. Udostępnij go jako Edytujący dla konta ' +
            `usługi: ${writeServiceAccountEmail()} — a następnie spróbuj ponownie.`,
        }
      }

      const created = await payload.create({
        collection: 'kosztoryses',
        data: { googleSheetId, name: name?.trim() || access.title || googleSheetId },
        overrideAccess: true,
      })

      try {
        await stampAllTabs(googleSheetId, payload, 'setup')
      } catch (err) {
        logError(`[sheets] setupTab failed for ${googleSheetId} (non-fatal):`, err)
      }

      return { success: true, data: { sheetId: created.id as number, name: created.name } }
    },
    ['kosztoryses'],
  )
}

export async function linkSheetToInvestmentAction(sheetId: number, investmentId: number) {
  return investmentAction(
    'linkSheetToInvestmentAction',
    { investmentId },
    async ({ payload }) => {
      const [sheet, investment, investmentHasSheet] = await Promise.all([
        payload.findByID({
          collection: 'kosztoryses',
          id: sheetId,
          depth: 0,
          overrideAccess: true,
        }),
        payload.findByID({
          collection: 'investments',
          id: investmentId,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'kosztoryses',
          where: { investment: { equals: investmentId } },
          depth: 0,
          limit: 1,
          overrideAccess: true,
        }),
      ])

      if (!sheet) return { success: false, error: 'Kosztorys nie istnieje.' }
      if (sheet.investment) {
        return { success: false, error: 'Ten kosztorys jest już dodany do inwestycji.' }
      }
      if (!investment) return { success: false, error: 'Inwestycja nie istnieje.' }
      if (investmentHasSheet.docs.length > 0) {
        return { success: false, error: 'Ta inwestycja ma już kosztorys.' }
      }

      await payload.update({
        collection: 'kosztoryses',
        id: sheetId,
        data: { investment: investmentId },
        overrideAccess: true,
      })

      // Fire-and-forget: a slow Google round-trip mustn't keep the
      // UI spinner up — and a sync failure shouldn't undo the link.
      void applyMaterialSync(investmentId).catch((err) => {
        logError(`[sheets] post-link sync for investment #${investmentId} failed:`, err)
      })

      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}

/**
 * Both sheet mutations that can touch a linked investment gate by hand rather than through
 * `investmentAction`: the target is the sheet's own investment, and that FK is nullable — an
 * unlinked sheet has no target and must still pass, which the wrapper's resolver reads as
 * „row missing".
 */
async function lockedSheetError(
  payload: Payload,
  sheetId: number,
): Promise<{ success: false; error: string } | undefined> {
  const sheet = await payload
    .findByID({ collection: 'kosztoryses', id: sheetId, depth: 0, overrideAccess: true })
    .catch(() => undefined)
  if (!sheet) return { success: false, error: 'Kosztorys nie istnieje.' }

  const lockMessage = await relatedInvestmentLockMessage(await getDb(payload), sheet.investment)
  return lockMessage ? { success: false, error: lockMessage } : undefined
}

export async function unlinkSheetFromInvestmentAction(sheetId: number) {
  return protectedAction(
    'unlinkSheetFromInvestmentAction',
    async ({ payload }) => {
      const locked = await lockedSheetError(payload, sheetId)
      if (locked) return locked

      await payload.update({
        collection: 'kosztoryses',
        id: sheetId,
        data: { investment: null },
        overrideAccess: true,
      })

      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}

export async function saveSheetColumnMappingAction(
  investmentId: number,
  field: string,
  column: number,
) {
  return investmentAction(
    'saveSheetColumnMappingAction',
    { investmentId },
    async ({ payload }) => {
      // The browser sends both halves, so both are re-checked here — a bad pair would otherwise sit
      // in jsonb until an import silently read the wrong column.
      if (!isColumnField(field) || !isPointableColumn(column)) {
        return { success: false, error: 'Nieprawidłowe wskazanie kolumny.' }
      }

      const sheet = await getInvestmentSheet(payload, investmentId)
      if (!sheet) return { success: false, error: MISSING_SHEET }

      await payload.update({
        collection: 'kosztoryses',
        id: sheet.id,
        data: { sheetColumnMapping: { ...sheet.sheetColumnMapping, [field]: column } },
        overrideAccess: true,
      })

      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}

export async function clearSheetColumnMappingAction(investmentId: number, field: string) {
  return investmentAction(
    'clearSheetColumnMappingAction',
    { investmentId },
    async ({ payload }) => {
      if (!isColumnField(field)) {
        return { success: false, error: 'Nieprawidłowe wskazanie kolumny.' }
      }

      const sheet = await getInvestmentSheet(payload, investmentId)
      if (!sheet) return { success: false, error: MISSING_SHEET }

      const mapping = { ...sheet.sheetColumnMapping }
      delete mapping[field]

      await payload.update({
        collection: 'kosztoryses',
        id: sheet.id,
        data: { sheetColumnMapping: mapping },
        overrideAccess: true,
      })

      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}

/**
 * `protectedAction` only gates at
 * MANAGEMENT_ROLES, which includes MANAGER; without this check, a manager
 * would bypass the collection's tighter intent via `overrideAccess: true`.
 */
export async function deleteSheetAction(sheetId: number) {
  return protectedAction(
    'deleteSheetAction',
    async ({ payload, user }) => {
      if (!(ADMIN_OR_OWNER_ROLES as readonly string[]).includes(user.role)) {
        return { success: false, error: 'Brak uprawnień do usuwania kosztorysów.' }
      }

      // Deleting the record unlinks the investment as a side effect, so it moves the same figure
      // the unlink action does — the lock has to reach both or it reaches neither.
      const locked = await lockedSheetError(payload, sheetId)
      if (locked) return locked

      await payload.delete({
        collection: 'kosztoryses',
        id: sheetId,
        overrideAccess: true,
      })
      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}
