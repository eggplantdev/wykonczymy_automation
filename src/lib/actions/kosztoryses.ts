'use server'

import { applyMaterialSync } from '@/lib/actions/sheets-sync'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { extractSheetId, serviceAccountEmail, verifySheetAccess } from '@/lib/google/sheet-access'
import { setupMaterialyTab } from '@/lib/google/sheets'
import { protectedAction } from './utils'

/**
 * Register an existing Google Sheet as a kosztorys WITHOUT linking it to an
 * investment. Lets the owner cost a project before the investment is committed
 * — the link step happens later via linkKosztorysToInvestmentAction (or the
 * per-investment "Powiąż istniejący arkusz" flow on the investment page).
 *
 * Flow: extract id → verify the SA can edit it → create the kosztoryses row →
 * stamp the materiały tab (banner + header + summary + protection). The setup
 * step is best-effort: if it fails, the kosztorys row still exists and the
 * setup can be retried from the per-investment page after linking.
 */
export async function addUnlinkedKosztorysAction(input: string, name?: string) {
  return protectedAction<{ kosztorysId: number; name: string }>(
    'addUnlinkedKosztorysAction',
    async ({ payload }) => {
      const sheetId = extractSheetId(input)
      if (!sheetId) {
        return { success: false, error: 'Nieprawidłowy link lub identyfikator arkusza Google.' }
      }

      // Same loud-rejection as linkKosztorysSheetAction: the unique constraint
      // would also throw, but a Polish error is friendlier than a 500.
      const existing = await payload.find({
        collection: 'kosztoryses',
        where: { googleSheetId: { equals: sheetId } },
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

      const access = await verifySheetAccess(sheetId)
      if (!access) {
        return {
          success: false,
          error:
            'Nie można otworzyć tego arkusza. Udostępnij go jako Edytujący dla konta ' +
            `usługi: ${serviceAccountEmail()} — a następnie spróbuj ponownie.`,
        }
      }

      // Default name to the sheet's title — the owner can rename it later from
      // the admin panel (the listing page shows whichever is set).
      const created = await payload.create({
        collection: 'kosztoryses',
        data: { googleSheetId: sheetId, name: name?.trim() || access.title || sheetId },
        overrideAccess: true,
      })

      // Stamp the materiały tab so the sheet is ready to receive expenses the
      // moment it's linked to an investment. Best-effort — log and continue on
      // failure so the row is at least created. The owner can retry via the
      // per-investment "reset" button after linking.
      try {
        const cats = await payload.find({
          collection: 'expense-categories',
          limit: 100,
          overrideAccess: true,
        })
        const types = cats.docs
          .map((c) => (c as { name?: string }).name)
          .filter((n): n is string => !!n)
        await setupMaterialyTab(sheetId, types)
      } catch (err) {
        console.error(`[kosztoryses] setupMaterialyTab failed for ${sheetId} (non-fatal):`, err)
      }

      return { success: true, data: { kosztorysId: created.id as number, name: created.name } }
    },
    ['kosztoryses'],
  )
}

/**
 * Attach a previously unlinked kosztorys to an investment. After the FK is
 * set, the materiały tab gets populated from the investment's expenses (a
 * normal sync run, fire-and-forget so the action returns fast).
 */
export async function linkKosztorysToInvestmentAction(kosztorysId: number, investmentId: number) {
  return protectedAction(
    'linkKosztorysToInvestmentAction',
    async ({ payload }) => {
      // The three lookups are independent — fetch them in parallel. The partial
      // unique index on investment_id WHERE NOT NULL would also catch a double-
      // link at the DB layer; the loud check turns it into a Polish error first.
      const [kosztorys, investment, investmentHasKosztorys] = await Promise.all([
        payload.findByID({
          collection: 'kosztoryses',
          id: kosztorysId,
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

      if (!kosztorys) return { success: false, error: 'Kosztorys nie istnieje.' }
      if (kosztorys.investment) {
        return { success: false, error: 'Ten kosztorys jest już dodany do inwestycji.' }
      }
      if (!investment) return { success: false, error: 'Inwestycja nie istnieje.' }
      if (investmentHasKosztorys.docs.length > 0) {
        return { success: false, error: 'Ta inwestycja ma już kosztorys.' }
      }

      await payload.update({
        collection: 'kosztoryses',
        id: kosztorysId,
        data: { investment: investmentId },
        overrideAccess: true,
      })

      // Populate the sheet from the investment's expenses now that the link is
      // in place. Fire-and-forget: a slow Google round-trip mustn't keep the
      // UI spinner up — and a sync failure shouldn't undo the link.
      void applyMaterialSync(investmentId).catch((err) => {
        console.error(`[kosztoryses] post-link sync for investment #${investmentId} failed:`, err)
      })

      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}

/**
 * Detach a kosztorys from its investment, leaving the sheet untouched. The
 * row stays as an "unlinked kosztorys" — re-linkable later from the listing.
 */
export async function unlinkKosztorysFromInvestmentAction(kosztorysId: number) {
  return protectedAction(
    'unlinkKosztorysFromInvestmentAction',
    async ({ payload }) => {
      const kosztorys = await payload.findByID({
        collection: 'kosztoryses',
        id: kosztorysId,
        depth: 0,
        overrideAccess: true,
      })
      if (!kosztorys) return { success: false, error: 'Kosztorys nie istnieje.' }

      await payload.update({
        collection: 'kosztoryses',
        id: kosztorysId,
        data: { investment: null },
        overrideAccess: true,
      })

      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}

/**
 * Delete the kosztorys row only — the Google Sheet stays as-is (it lives on
 * the owner's Drive; we don't have permission and shouldn't presume).
 *
 * Tighter than the other actions: the collection's `delete` access is
 * `isAdminOrOwner` (matches investments — destructive ops kept narrower),
 * so we re-check the role here. `protectedAction` only gates at
 * MANAGEMENT_ROLES, which includes MANAGER; without this check, a manager
 * would bypass the collection's tighter intent via `overrideAccess: true`.
 */
export async function deleteKosztorysAction(kosztorysId: number) {
  return protectedAction(
    'deleteKosztorysAction',
    async ({ payload, user }) => {
      if (!(ADMIN_OR_OWNER_ROLES as readonly string[]).includes(user.role)) {
        return { success: false, error: 'Brak uprawnień do usuwania kosztorysów.' }
      }
      await payload.delete({
        collection: 'kosztoryses',
        id: kosztorysId,
        overrideAccess: true,
      })
      return { success: true }
    },
    ['kosztoryses', 'investments'],
  )
}
