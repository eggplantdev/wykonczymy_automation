'use server'

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
      // if Drive is down, the template was deleted, or the SA lost access — the
      // banner from Task 9 will surface the missing googleSheetId and offer a
      // manual retry via provisionKosztorysAction below.
      void (async () => {
        try {
          const { sheetId } = await createKosztorysFromTemplate(created.name)
          await payload.update({
            collection: 'investments',
            id: created.id,
            data: { googleSheetId: sheetId },
            overrideAccess: true,
          })
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
export async function getServiceAccountEmailAction(): Promise<string> {
  return serviceAccountEmail()
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
