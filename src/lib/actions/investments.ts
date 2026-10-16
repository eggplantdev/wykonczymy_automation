'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { extractSheetId, verifySheetAccess } from '@/lib/google/sheet-access'
import { writeServiceAccountEmail } from '@/lib/google/auth'
import { stampAllTabs } from '@/lib/google/app-managed-tabs'
import {
  investmentClientFieldsSchema,
  investmentSchema,
  type InvestmentClientFieldsT,
  type InvestmentFormDataT,
} from '@/components/forms/investment-form/investment-schema'
import { createInvestment } from '@/lib/investments/create-investment'
import { INVESTMENT_AI_STAGES, type InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction, protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'

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

// never throws: returns '' if the
// caller isn't authed or the credential env var is unset, so the caller's
// fire-and-forget `.then(setSaEmail)` can't raise an unhandled rejection
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

      // Two
      // investments sharing one tab would each treat the other's rows as orphans
      // and delete them on sync
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

      try {
        await stampAllTabs(sheetId, payload, 'ensure')
      } catch (err) {
        logError(`[link-sheet] ensureTab failed for #${investmentId} (non-fatal):`, err)
      }

      return { success: true, data: { title: access.title } }
    },
    ['kosztoryses', 'investments'],
  )
}

export async function updateInvestmentAction(id: number, data: InvestmentFormDataT) {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload, user }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      // the edit form carries no file picker, so the
      // schema's `.default([])` would arrive as an empty list and wipe the gallery.
      const { presetId: _presetId, assets: _assets, ...investmentData } = parsed.data
      // without it `createLocalReq` sets `req.user = null`
      // and `guardInvestmentStatusUnlock` refuses to reopen a zakończona inwestycja for EVERY role,
      // właściciel included
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

// sending the whole record from the
// editor's page-load copy would revert an edit made elsewhere since — a status change included.
export async function updateInvestmentClientFieldsAction(
  id: number,
  data: InvestmentClientFieldsT,
) {
  return protectedAction(
    'updateInvestmentClientFieldsAction',
    async ({ payload, user }) => {
      const parsed = validateAction(investmentClientFieldsSchema, data)
      if (!parsed.success) return parsed

      await payload.update({ collection: 'investments', id, data: parsed.data, user })

      return { success: true }
    },
    ['investments'],
  )
}

const aiStageSchema = z.enum(INVESTMENT_AI_STAGES).nullable()

// the edit form and the notes save send the whole
// record, and a stage riding along would be overwritten from a stale copy.
export async function setInvestmentAiStageAction(id: number, aiStage: InvestmentAiStageT | null) {
  return protectedAction(
    'setInvestmentAiStageAction',
    async ({ payload, user }) => {
      const parsed = validateAction(aiStageSchema, aiStage)
      if (!parsed.success) return parsed

      await payload.update({ collection: 'investments', id, data: { aiStage: parsed.data }, user })

      return { success: true }
    },
    ['investments'],
  )
}
