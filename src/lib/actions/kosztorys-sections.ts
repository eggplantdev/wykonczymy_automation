'use server'

import { after } from 'next/server'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { translateSectionName } from '@/lib/actions/translate-section-name'
import { SECTION_NOT_FOUND } from '@/lib/constants/not-found'
import { getDb } from '@/lib/db/get-db'
import { applyLayout, lockAndCheckLayout } from '@/lib/db/kosztorys-layout'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { createSection, type CreatedSectionT } from '@/lib/kosztorys/create-section'
import {
  insertSectionSchema,
  resolveInsertSlot,
  shiftDisplayOrderFrom,
  type InsertDirectionT,
} from '@/lib/kosztorys/display-order'
import {
  kosztorysLayoutSchema,
  LAYOUT_STALE,
  type KosztorysLayoutT,
} from '@/lib/kosztorys/reorder-layout'
import { sectionPatchSchema, type SectionPatchT } from '@/lib/kosztorys/section-patch-schema'
import type { ActionResultT } from '@/types/action'

export type { SectionPatchT } from '@/lib/kosztorys/section-patch-schema'

export async function updateSectionFieldAction(sectionId: number, patch: SectionPatchT) {
  return investmentAction(
    'updateSectionFieldAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(sectionPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-sections', id: sectionId, data: parsed.data })
      const { name } = parsed.data
      if (name !== undefined) after(() => translateSectionName(payload, name))
      return { success: true }
    },
    ['kosztorysSections'],
    { deferRefresh: true },
  )
}

export async function addSectionAction(
  investmentId: number,
): Promise<ActionResultT<CreatedSectionT>> {
  return investmentAction(
    'addSectionAction',
    { investmentId },
    async ({ payload }) => {
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await shiftDisplayOrderFrom(txDb, 'kosztorys-sections', investmentId, 0)
          return createSection(payload, { investmentId, displayOrder: 0, req })
        },
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysSections'],
  )
}

export async function removeSectionAction(sectionId: number) {
  return investmentAction(
    'removeSectionAction',
    { kind: 'section', id: sectionId },
    async ({ payload, user, investmentId }) => {
      const db = await getDb(payload)
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-sections', id: sectionId })
      return { success: true }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

export async function insertSectionAction(
  anchorSectionId: number,
  dir: InsertDirectionT,
): Promise<ActionResultT<CreatedSectionT>> {
  return investmentAction(
    'insertSectionAction',
    { kind: 'section', id: anchorSectionId },
    async ({ payload }) => {
      const parsed = validateAction(insertSectionSchema, { anchorSectionId, dir })
      if (!parsed.success) return parsed
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          const slot = await resolveInsertSlot(
            txDb,
            'kosztorys-sections',
            parsed.data.anchorSectionId,
            parsed.data.dir,
          )
          if (!slot) return null
          await shiftDisplayOrderFrom(txDb, 'kosztorys-sections', slot.ownerId, slot.at)
          return createSection(payload, {
            investmentId: slot.ownerId,
            displayOrder: slot.at,
            req,
          })
        },
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: SECTION_NOT_FOUND }
      return { success: true, data: created }
    },
    ['kosztorysSections'],
  )
}

export async function writeKosztorysLayoutAction(
  investmentId: number,
  layout: KosztorysLayoutT,
): Promise<ActionResultT> {
  return investmentAction(
    'writeKosztorysLayoutAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(kosztorysLayoutSchema, layout)
      if (!parsed.success) return parsed
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const tx = await getDb(payload, req)
          if (!(await lockAndCheckLayout(tx, investmentId, parsed.data))) {
            return { success: false, error: LAYOUT_STALE, code: 'NOT_FOUND' }
          }
          await captureAutoSnapshot(tx, investmentId, user.id, req)
          await applyLayout(tx, investmentId, parsed.data)
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}
