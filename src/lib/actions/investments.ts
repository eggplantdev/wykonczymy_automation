'use server'

import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { createKosztorysFromTemplate, isStorageQuotaError } from '@/lib/google/drive'
import { extractSheetId, serviceAccountEmail, verifySheetAccess } from '@/lib/google/sheet-access'
import { setupMaterialyTab } from '@/lib/google/sheets'
import { investmentSchema, type InvestmentFormDataT } from '@/lib/schemas/investment'
import { validateAction, protectedAction } from './utils'

// Attach (or reset) a fresh materiały tab on the investment's linked sheet.
// Header + summary are written by the app — the owner builds nothing. Works on a
// personal Google account because it never creates a new file (see approach A).
export async function setupKosztorysSheetAction(investmentId: number) {
  return protectedAction<{ types: string[] }>('setupKosztorysSheetAction', async ({ payload }) => {
    const investment = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      overrideAccess: true,
    })
    if (!investment?.googleSheetId) {
      return {
        success: false,
        error: 'Inwestycja nie ma powiązanego arkusza Google — najpierw podłącz arkusz.',
      }
    }

    const cats = await payload.find({
      collection: 'expense-categories',
      limit: 100,
      overrideAccess: true,
    })
    const types = cats.docs
      .map((c) => (c as { name?: string }).name)
      .filter((n): n is string => !!n)

    await setupMaterialyTab(investment.googleSheetId, types)
    return { success: true, data: { types } }
  })
}

export async function createInvestmentAction(data: InvestmentFormDataT) {
  return protectedAction(
    'createInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      const created = await payload.create({
        collection: 'investments',
        data: parsed.data,
      })

      // Fire-and-forget Drive provisioning. The investment create succeeds even
      // when the copy fails — and on a personal-account SA it currently ALWAYS
      // fails ("storage quota exceeded" — the SA has no Drive of its own; needs
      // a Workspace Shared Drive). The no-sheet banner then surfaces the missing
      // googleSheetId and the user takes the working path: "Powiąż istniejący
      // arkusz" via linkKosztorysSheetAction (paste an owner-shared sheet).
      void (async () => {
        try {
          const { sheetId } = await createKosztorysFromTemplate(created.name)
          await payload.update({
            collection: 'investments',
            id: created.id,
            data: { googleSheetId: sheetId },
            overrideAccess: true,
          })
          // Revalidate again here: protectedAction already revalidated ['investments']
          // when the handler returned, but this fire-and-forget write lands AFTER that,
          // so without this the banner/listing keep showing hasSheet=false until an
          // unrelated mutation invalidates the tag (review T2.8). revalidateTag (not
          // updateTag) — this runs detached, past the action's execution context.
          revalidateTag(CACHE_TAGS.investments, 'default')
          console.log(`[kosztorys-provision] investment #${created.id} → sheet provisioned`)
        } catch (err) {
          console.error(`[kosztorys-provision] investment #${created.id} failed (non-fatal):`, err)
        }
      })()

      return { success: true }
    },
    ['investments'],
  )
}

/**
 * Manual counterpart to the auto-provision in createInvestmentAction. Wired to
 * the "Utwórz nowy kosztorys" CTA on the no-sheet banner (Task 9). Synchronous
 * — the user is staring at a button, so we wait for Drive to land before
 * returning so the UI can refresh and show the iframe.
 */
export async function provisionKosztorysAction(investmentId: number) {
  return protectedAction<{ sheetId: string }>(
    'provisionKosztorysAction',
    async ({ payload }) => {
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      if (!investment) return { success: false, error: 'Inwestycja nie istnieje.' }
      if (investment.googleSheetId) {
        return { success: false, error: 'Ta inwestycja ma już powiązany arkusz.' }
      }

      let sheetId: string
      try {
        ;({ sheetId } = await createKosztorysFromTemplate(investment.name))
      } catch (err) {
        const msg = String(err)
        if (isStorageQuotaError(err)) {
          return {
            success: false,
            error:
              'Nie można utworzyć nowego arkusza — konto usługi Google nie ma miejsca na dysku. ' +
              'Tworzenie nowych kosztorysów będzie możliwe po skonfigurowaniu Dysku współdzielonego ' +
              '(Google Workspace). Na razie użyj opcji „Powiąż istniejący arkusz”.',
          }
        }
        return { success: false, error: `Nie udało się utworzyć arkusza: ${msg}` }
      }

      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { googleSheetId: sheetId },
        overrideAccess: true,
      })

      return { success: true, data: { sheetId } }
    },
    ['investments'],
  )
}

/**
 * Link an EXISTING Google Sheet to an investment. Accepts a pasted sheet URL or a
 * raw id; verifies the service account can actually open it (else the sync/iframe
 * would silently fail), then stores its id. The working alternative to
 * provisionKosztorysAction while new-file creation is blocked by SA Drive quota.
 */
// The service-account email a user must share their sheet with before linking.
// Non-secret; surfaced in the setup dialog so the share step is clear up front
// (not only discovered via the "share with…" error after a failed link attempt).
// Requires auth (like every other action here) and never throws: returns '' if the
// caller isn't authed or the credential env var is unset, so the caller's
// fire-and-forget `.then(setSaEmail)` can't raise an unhandled rejection (T3.2).
export async function getServiceAccountEmailAction(): Promise<string> {
  const auth = await requireAuth(MANAGEMENT_ROLES)
  if (!auth.success) return ''
  try {
    return serviceAccountEmail()
  } catch {
    return ''
  }
}

export async function linkKosztorysSheetAction(investmentId: number, input: string) {
  return protectedAction<{ title: string }>(
    'linkKosztorysSheetAction',
    async ({ payload }) => {
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      if (!investment) return { success: false, error: 'Inwestycja nie istnieje.' }
      if (investment.googleSheetId) {
        return { success: false, error: 'Ta inwestycja ma już powiązany arkusz.' }
      }

      const sheetId = extractSheetId(input)
      if (!sheetId) {
        return { success: false, error: 'Nieprawidłowy link lub identyfikator arkusza Google.' }
      }

      // Refuse a sheet already linked to another investment. Two investments sharing
      // one tab would each treat the other's rows as orphans and delete them on sync
      // (T1.3). (The DB unique constraint is the belt-and-suspenders for direct admin
      // edits; this guard covers the link flow.)
      const alreadyLinked = await payload.find({
        collection: 'investments',
        where: {
          and: [{ googleSheetId: { equals: sheetId } }, { id: { not_equals: investmentId } }],
        },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (alreadyLinked.docs.length > 0) {
        return {
          success: false,
          error: `Ten arkusz jest już powiązany z inną inwestycją („${alreadyLinked.docs[0].name}”).`,
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

      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { googleSheetId: sheetId },
        overrideAccess: true,
      })

      return { success: true, data: { title: access.title } }
    },
    ['investments'],
  )
}

export async function updateInvestmentAction(id: number, data: InvestmentFormDataT) {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      await payload.update({
        collection: 'investments',
        id,
        data: parsed.data,
      })

      return { success: true }
    },
    ['investments'],
  )
}
