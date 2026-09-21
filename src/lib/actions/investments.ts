'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { extractSheetId, verifySheetAccess } from '@/lib/google/sheet-access'
import { writeServiceAccountEmail } from '@/lib/google/auth'
import { stampAllTabs } from '@/lib/google/app-managed-tabs'
import {
  investmentSchema,
  type InvestmentFormDataT,
} from '@/components/forms/investment-form/investment-schema'
import { createInvestment } from '@/lib/investments/create-investment'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction, protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'

// Attach (or reset) a fresh materiały tab on the investment's linked sheet.
// Header + summary are written by the app — the owner builds nothing. Works on a
// personal Google account because it never creates a new file (see approach A).
export async function setupSheetAction(investmentId: number) {
  return investmentAction('setupSheetAction', { investmentId }, async ({ payload }) => {
    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      return {
        success: false,
        error: 'Inwestycja nie ma kosztorysu — najpierw dodaj kosztorys.',
      }
    }

    await stampAllTabs(sheetId, payload, 'setup')
    return { success: true }
  })
}

export async function createInvestmentAction(data: InvestmentFormDataT) {
  return protectedAction(
    'createInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      const { warning } = await createInvestment(payload, parsed.data)
      return { success: true, warning }
    },
    ['investments'],
  )
}

/**
 * Link an EXISTING Google Sheet to an investment. Accepts a pasted sheet URL or a
 * raw id; verifies the service account can actually open it (else the sync/iframe
 * would silently fail), then stores its id. New-file creation from a template is
 * not offered — the service account has no Drive quota, so linking an existing
 * sheet is the only supported path.
 */
// The service-account email a user must share their sheet with AS EDITOR before linking — the
// Editor account, never the Viewer one the app reads with. Granting Editor to the reader would hand
// write rights back to every laptop and preview deploy for that sheet, which is the hole the
// two-account split exists to close.
// Non-secret; surfaced in the setup dialog so the share step is clear up front
// (not only discovered via the "share with…" error after a failed link attempt).
// Requires auth (like every other action here) and never throws: returns '' if the
// caller isn't authed or the credential env var is unset, so the caller's
// fire-and-forget `.then(setSaEmail)` can't raise an unhandled rejection (T3.2).
export async function getServiceAccountEmailAction(): Promise<string> {
  const auth = await requireAuth(MANAGEMENT_ROLES)
  if (!auth.success) return ''
  try {
    return writeServiceAccountEmail()
  } catch {
    return ''
  }
}

export async function linkSheetAction(investmentId: number, input: string) {
  return investmentAction<{ title: string }>(
    'linkSheetAction',
    { investmentId },
    async ({ payload }) => {
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      if (!investment) return { success: false, error: 'Inwestycja nie istnieje.' }

      const existing = await getInvestmentSheetId(payload, investmentId)
      if (existing) {
        return { success: false, error: 'Ta inwestycja ma już kosztorys.' }
      }

      const sheetId = extractSheetId(input)
      if (!sheetId) {
        return { success: false, error: 'Nieprawidłowy link lub identyfikator arkusza Google.' }
      }

      // Refuse a sheet already registered as a kosztorys (linked or not). Two
      // investments sharing one tab would each treat the other's rows as orphans
      // and delete them on sync (T1.3). The kosztoryses.google_sheet_id UNIQUE
      // constraint is the belt-and-suspenders for direct admin edits; this guard
      // surfaces the conflict with a Polish error instead of a 500.
      const alreadyRegistered = await payload.find({
        collection: 'kosztoryses',
        where: { googleSheetId: { equals: sheetId } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (alreadyRegistered.docs.length > 0) {
        return {
          success: false,
          error:
            'Ten arkusz jest już zarejestrowany w aplikacji jako kosztorys. ' +
            'Powiąż go z inwestycją z listy „Kosztorysy".',
        }
      }

      const access = await verifySheetAccess(sheetId)
      if (!access) {
        return {
          success: false,
          error:
            'Nie można otworzyć tego arkusza. Udostępnij go jako Edytujący dla konta ' +
            `usługi: ${writeServiceAccountEmail()} — a następnie spróbuj ponownie.`,
        }
      }

      await payload.create({
        collection: 'kosztoryses',
        data: { googleSheetId: sheetId, name: access.title, investment: investmentId },
        overrideAccess: true,
      })

      // Create-if-missing: build the expenses tab only when the linked sheet doesn't
      // already have one. Never wipes an existing tab — the owner may be attaching a
      // sheet they've already filled in by hand; that destructive path stays behind
      // the explicit "Zresetuj wydatki inwestycyjne" button. Non-fatal: a Sheets
      // hiccup here must not fail the link (the row is already registered) — the user
      // can still reset manually, and the first sync surfaces a missing tab with that
      // exact hint.
      try {
        await stampAllTabs(sheetId, payload, 'ensure')
      } catch (err) {
        logError(`[link-sheet] ensureTab failed for #${investmentId} (non-fatal):`, err)
      }

      return { success: true, data: { title: access.title } }
    },
    // Affects both the kosztoryses listing and the investments table (hasSheet flips true).
    ['kosztoryses', 'investments'],
  )
}

export async function updateInvestmentAction(id: number, data: InvestmentFormDataT) {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload, user }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      // presetId is a create-only seed field; the edit form always sends '' — never write it.
      // `assets` is dropped for a different reason: the edit form carries no file picker, so the
      // schema's `.default([])` would arrive as an empty list and wipe the gallery. The attach /
      // detach actions below are the field's only writers after create.
      const { presetId: _presetId, assets: _assets, ...investmentData } = parsed.data
      // `user` is load-bearing, not decoration: without it `createLocalReq` sets `req.user = null`
      // and `guardInvestmentStatusUnlock` refuses to reopen a zakończona inwestycja for EVERY role,
      // właściciel included — the lock becomes a door with no key.
      await payload.update({
        collection: 'investments',
        id,
        data: investmentData,
        user,
      })

      return { success: true }
    },
    ['investments'],
  )
}
