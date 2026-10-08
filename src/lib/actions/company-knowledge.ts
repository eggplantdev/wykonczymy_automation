'use server'

import { z } from 'zod'
import { applyCompanyKnowledgeOrder, nextTopDisplayOrder } from '@/lib/db/company-knowledge'
import { getDb } from '@/lib/db/get-db'
import { protectedAction, validateAction } from './run-action'

const entrySchema = z.object({
  topic: z.string().trim().min(1, 'Wpis musi mieć temat'),
  content: z.string().trim().min(1, 'Wpis musi mieć treść'),
})

export type CompanyKnowledgeDataT = z.input<typeof entrySchema>

const idSchema = z.number().int().positive()

const orderSchema = z
  .array(idSchema)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, 'Kolejność powtarza wpis')

export async function createCompanyKnowledgeAction(data: CompanyKnowledgeDataT) {
  return protectedAction<{ id: number }>(
    'createCompanyKnowledgeAction',
    async ({ payload }) => {
      const parsed = validateAction(entrySchema, data)
      if (!parsed.success) return parsed

      const displayOrder = await nextTopDisplayOrder(await getDb(payload))
      const created = await payload.create({
        collection: 'company-knowledge',
        data: { ...parsed.data, displayOrder },
      })
      return { success: true, data: { id: Number(created.id) } }
    },
    ['companyKnowledge'],
  )
}

export async function updateCompanyKnowledgeAction(id: number, data: CompanyKnowledgeDataT) {
  return protectedAction(
    'updateCompanyKnowledgeAction',
    async ({ payload }) => {
      const parsedId = validateAction(idSchema, id)
      if (!parsedId.success) return parsedId
      const parsed = validateAction(entrySchema, data)
      if (!parsed.success) return parsed

      await payload.update({
        collection: 'company-knowledge',
        id: parsedId.data,
        data: parsed.data,
      })
      return { success: true }
    },
    ['companyKnowledge'],
  )
}

export async function deleteCompanyKnowledgeAction(id: number) {
  return protectedAction(
    'deleteCompanyKnowledgeAction',
    async ({ payload }) => {
      const parsedId = validateAction(idSchema, id)
      if (!parsedId.success) return parsedId

      await payload.delete({ collection: 'company-knowledge', id: parsedId.data })
      return { success: true }
    },
    ['companyKnowledge'],
  )
}

export async function reorderCompanyKnowledgeAction(ids: number[]) {
  return protectedAction(
    'reorderCompanyKnowledgeAction',
    async ({ payload }) => {
      const parsed = validateAction(orderSchema, ids)
      if (!parsed.success) return parsed

      await applyCompanyKnowledgeOrder(await getDb(payload), parsed.data)
      return { success: true }
    },
    ['companyKnowledge'],
  )
}
