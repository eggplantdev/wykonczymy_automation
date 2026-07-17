'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { createSheetFromTemplate, isStorageQuotaError } from '@/lib/google/drive'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { extractSheetId, serviceAccountEmail, verifySheetAccess } from '@/lib/google/sheet-access'
import { stampAllTabs } from '@/lib/google/app-managed-tabs'
import {
  investmentSchema,
  type InvestmentFormDataT,
} from '@/components/forms/investment-form/investment-schema'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import { seedBlankKosztorys } from '@/lib/kosztorys/seed-blank'
import { validateAction, protectedAction } from './run-action'

const SEED_PRESET_WARNING =
  'Inwestycja utworzona, ale nie udało się wypełnić kosztorysu z szablonu. Otwórz edytor i uzupełnij ręcznie.'
const SEED_BLANK_WARNING =
  'Inwestycja utworzona, ale nie udało się przygotować kosztorysu. Otwórz edytor, aby dodać pozycje.'

// Attach (or reset) a fresh materiały tab on the investment's linked sheet.
// Header + summary are written by the app — the owner builds nothing. Works on a
// personal Google account because it never creates a new file (see approach A).
export async function setupSheetAction(investmentId: number) {
  return protectedAction('setupSheetAction', async ({ payload }) => {
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

      // presetId is a form-only field (seed source), never an investments column.
      const { presetId, ...investmentData } = parsed.data
      const created = await payload.create({
        collection: 'investments',
        data: investmentData,
      })

      // Seed the new (trivially empty) investment's kosztorys from the chosen preset. Best-effort and
      // NON-FATAL: the investment is already committed, so a seed failure must never flip the whole
      // action to failure — that would skip the ['investments'] revalidation (hiding the just-created
      // investment from the cached list) and invite a duplicate-creating retry. Instead we surface a
      // `warning` the form toasts, so the user isn't left staring at a silently-empty kosztorys (the
      // "Wypełnij z szablonu" CTA still lets them retry). No kosztorys* tree tags here — a fresh
      // investment has no cached tree to invalidate yet.
      let warning: string | undefined
      const chosenPresetId = presetId ? Number(presetId) : null
      if (chosenPresetId) {
        try {
          const result = await seedInvestmentFromPreset(payload, Number(created.id), chosenPresetId)
          if (result !== 'ok') {
            // TODO(EX-449) SENTRY-REQUIRED: silent seed skip the user can't self-report.
            console.error(
              `[create-investment] seed from preset ${chosenPresetId} skipped for #${created.id}: ${result}`,
            )
            warning = SEED_PRESET_WARNING
          }
        } catch (err) {
          // TODO(EX-449) SENTRY-REQUIRED: silent seed failure the user can't self-report.
          console.error(
            `[create-investment] seed from preset ${chosenPresetId} failed for #${created.id} (non-fatal):`,
            err,
          )
          warning = SEED_PRESET_WARNING
        }
      } else {
        // No preset chosen → the editor would otherwise open on a blank grid: treeToRows emits rows
        // only from section.items, and the "＋ pozycja" button needs an active section that doesn't
        // exist yet — a dead cold-start (EX-463). Seed one section + one blank item so the user lands
        // on a typable row. Same non-fatal contract as the preset path above.
        try {
          await seedBlankKosztorys(payload, Number(created.id))
        } catch (err) {
          // TODO(EX-449) SENTRY-REQUIRED: silent blank-seed failure the user can't self-report.
          console.error(
            `[create-investment] blank kosztorys seed failed for #${created.id} (non-fatal):`,
            err,
          )
          warning = SEED_BLANK_WARNING
        }
      }

      return { success: true, warning }
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
export async function provisionSheetAction(investmentId: number) {
  return protectedAction<{ sheetId: string }>(
    'provisionSheetAction',
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

      let sheetId: string
      try {
        ;({ sheetId } = await createSheetFromTemplate(investment.name))
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

      await payload.create({
        collection: 'kosztoryses',
        data: { googleSheetId: sheetId, name: investment.name, investment: investmentId },
        overrideAccess: true,
      })

      return { success: true, data: { sheetId } }
    },
    // Affects both the kosztoryses listing and the investments table (hasSheet flips true).
    ['kosztoryses', 'investments'],
  )
}

/**
 * Link an EXISTING Google Sheet to an investment. Accepts a pasted sheet URL or a
 * raw id; verifies the service account can actually open it (else the sync/iframe
 * would silently fail), then stores its id. The working alternative to
 * provisionSheetAction while new-file creation is blocked by SA Drive quota.
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

export async function linkSheetAction(investmentId: number, input: string) {
  return protectedAction<{ title: string }>(
    'linkSheetAction',
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
            `usługi: ${serviceAccountEmail()} — a następnie spróbuj ponownie.`,
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
        console.error(`[link-sheet] ensureTab failed for #${investmentId} (non-fatal):`, err)
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
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      // presetId is a create-only seed field; the edit form always sends '' — never write it.
      const { presetId: _presetId, ...investmentData } = parsed.data
      await payload.update({
        collection: 'investments',
        id,
        data: investmentData,
      })

      return { success: true }
    },
    ['investments'],
  )
}
