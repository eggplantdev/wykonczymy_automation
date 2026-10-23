'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { extractSheetId, verifySheetAccess } from '@/lib/google/sheet-access'
import { writeServiceAccountEmail } from '@/lib/google/auth'
import { stampAllTabs } from '@/lib/google/app-managed-tabs'
import {
  investmentSchema,
  type InvestmentFormDataT,
} from '@/components/forms/investment-form/investment-schema'
import { createInvestment } from '@/lib/investments/create-investment'
import { INVESTMENT_AI_STAGES, type InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import { INVESTMENT_STATUSES, type InvestmentStatusT } from '@/lib/constants/investment-status'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction, protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'
import { getDb } from '@/lib/db/get-db'
import { notifyAiStageChange } from '@/lib/push/notify-ai-stage'

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

const statusSchema = z.enum(INVESTMENT_STATUSES)

// `user` lets `guardInvestmentStatusUnlock` admit the właściciel; without it every role is refused.
export async function setInvestmentStatusAction(id: number, status: InvestmentStatusT) {
  return protectedAction(
    'setInvestmentStatusAction',
    async ({ payload, user }) => {
      const parsed = validateAction(statusSchema, status)
      if (!parsed.success) return parsed

      await payload.update({ collection: 'investments', id, data: { status: parsed.data }, user })

      return { success: true }
    },
    ['investments'],
  )
}

const aiStageSchema = z.enum(INVESTMENT_AI_STAGES).nullable()

// the edit form sends the whole record, and a stage riding along would be overwritten from a stale
// copy.
export async function setInvestmentAiStageAction(id: number, aiStage: InvestmentAiStageT | null) {
  return protectedAction(
    'setInvestmentAiStageAction',
    async ({ payload, user }) => {
      const parsed = validateAction(aiStageSchema, aiStage)
      if (!parsed.success) return parsed

      const before = await payload.findByID({
        collection: 'investments',
        id,
        depth: 0,
        select: { aiStage: true, name: true },
      })
      await payload.update({ collection: 'investments', id, data: { aiStage: parsed.data }, user })

      if ((before.aiStage ?? null) !== parsed.data) {
        const stage = parsed.data
        after(async () =>
          notifyAiStageChange(payload, await getDb(payload), {
            investmentId: id,
            investmentName: before.name,
            stage,
            actorId: user.id,
          }),
        )
      }

      return { success: true }
    },
    ['investments'],
  )
}

const notesSchema = z.string()

// Through `updateInvestmentAction` a note would carry the rest of the record, and `investmentSchema`
// blanks every field the caller leaves out.
export async function setInvestmentNotesAction(id: number, notes: string) {
  return protectedAction(
    'setInvestmentNotesAction',
    async ({ payload, user }) => {
      const parsed = validateAction(notesSchema, notes)
      if (!parsed.success) return parsed

      await payload.update({ collection: 'investments', id, data: { notes: parsed.data }, user })

      return { success: true }
    },
    ['investments'],
  )
}

const siteManagerSchema = z.number().int().positive().nullable()

// `overrideAccess` because the field is closed to access-checked writes; `user` keeps the hooks'
// role checks.
export async function setInvestmentSiteManagerAction(id: number, userId: number | null) {
  return protectedAction(
    'setInvestmentSiteManagerAction',
    async ({ payload, user }) => {
      const parsed = validateAction(siteManagerSchema, userId)
      if (!parsed.success) return parsed

      if (parsed.data !== null) {
        const { docs } = await payload.find({
          collection: 'users',
          where: {
            id: { equals: parsed.data },
            active: { equals: true },
            trashedAt: { exists: false },
          },
          depth: 0,
          limit: 1,
          overrideAccess: true,
        })
        if (docs.length === 0) {
          return { success: false, error: 'Wybrane konto jest nieaktywne lub w Koszu.' }
        }
      }

      await payload.update({
        collection: 'investments',
        id,
        data: { siteManager: parsed.data },
        user,
        overrideAccess: true,
      })

      return { success: true }
    },
    ['investments'],
  )
}
