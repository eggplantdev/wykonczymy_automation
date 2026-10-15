'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { templateAction } from '@/lib/actions/template-action'
import { validateAction } from '@/lib/actions/run-action'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import {
  applyTemplateLayout,
  deleteTemplateSections,
  lockAndCheckTemplateLayout,
  lockTemplateItemSections,
} from '@/lib/db/template-structure'
import { bumpTemplateRevision, readTemplateRevision } from '@/lib/db/templates'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  numberWithinSections,
  renumberDisplayOrder,
  renumberDisplayOrderSchema,
} from '@/lib/kosztorys/display-order'
import {
  kosztorysLayoutSchema,
  LAYOUT_STALE,
  type KosztorysLayoutT,
} from '@/lib/kosztorys/reorder-layout'
import type { ActionResultT } from '@/types/action'

const ITEMS_NOT_IN_TEMPLATE = 'Pozycje spoza tego szablonu.'

// „Zapisz kolejność" on the szablon plane — same whole-tree lock and per-section numbering as
// `renumberKosztorysOrderAction`.
export async function renumberTemplateOrderAction(
  templateId: number,
  orderedItemIds: number[],
): Promise<ActionResultT> {
  return templateAction(
    'renumberTemplateOrderAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      const parsed = validateAction(renumberDisplayOrderSchema, orderedItemIds)
      if (!parsed.success) return parsed
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const txDb = await getDb(payload, req)
          const sectionById = await lockTemplateItemSections(txDb, templateId)
          if (parsed.data.some((id) => !sectionById.has(id))) {
            return { success: false, error: ITEMS_NOT_IN_TEMPLATE }
          }
          await renumberDisplayOrder(
            txDb,
            'template-items',
            numberWithinSections(parsed.data, sectionById),
          )
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
  )
}

// „Ustaw kolejność". The auto-snapshot before it arrives with the szablon's „Wersje".
export async function writeTemplateLayoutAction(
  templateId: number,
  layout: KosztorysLayoutT,
): Promise<ActionResultT> {
  return templateAction(
    'writeTemplateLayoutAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      const parsed = validateAction(kosztorysLayoutSchema, layout)
      if (!parsed.success) return parsed
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const tx = await getDb(payload, req)
          if (!(await lockAndCheckTemplateLayout(tx, templateId, parsed.data))) {
            return { success: false, error: LAYOUT_STALE, code: 'NOT_FOUND' }
          }
          await applyTemplateLayout(tx, templateId, parsed.data)
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
  )
}

export async function clearTemplateAction(templateId: number): Promise<ActionResultT> {
  return templateAction(
    'clearTemplateAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      await withPayloadTransaction(
        payload,
        async (req) => {
          const tx = await getDb(payload, req)
          await deleteTemplateSections(tx, templateId)
          await bumpTemplateRevision(tx, templateId)
        },
        { skipRevalidation: true },
      )
      return { success: true }
    },
  )
}

// Uncached on purpose, like `readKosztorysRevision`: it is the probe for a tree replaced elsewhere.
export async function readTemplateRevisionAction(templateId: number): Promise<string | undefined> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return undefined
  return readTemplateRevision(await getDb(await getPayload({ config })), templateId)
}
