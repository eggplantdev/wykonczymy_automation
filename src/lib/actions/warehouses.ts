'use server'

import { z } from 'zod'
import type { WarehouseOptionT } from '@/lib/equipment/types'
import { protectedAction, validateAction } from './run-action'

const warehouseNameSchema = z
  .string()
  .trim()
  .min(1, 'Nazwa magazynu jest wymagana')
  .max(120, 'Nazwa magazynu jest za długa')

/**
 * Create a warehouse from the equipment form, so „nie ma go na liście" doesn't send anyone to
 * /admin mid-entry.
 *
 * The name is matched case-insensitively against the whole dictionary before inserting, not left to
 * the unique index: the index would let „Kwiatowa" and „kwiatowa" both in, and two rows for one
 * place quietly halve every answer the „Gdzie jest" filter gives. There are a handful of them, so
 * reading them all is cheaper than being clever.
 */
export async function createWarehouseAction(name: string) {
  return protectedAction<WarehouseOptionT>(
    'createWarehouseAction',
    async ({ payload }) => {
      const parsed = validateAction(warehouseNameSchema, name)
      if (!parsed.success) return parsed

      const existing = await payload.find({
        collection: 'warehouses',
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      const clash = existing.docs.find(
        (warehouse) => warehouse.name.toLowerCase() === parsed.data.toLowerCase(),
      )
      if (clash) return { success: false, error: `Magazyn „${clash.name}" już istnieje` }

      const created = await payload.create({
        collection: 'warehouses',
        data: { name: parsed.data },
      })

      return { success: true, data: { id: created.id, name: created.name } }
    },
    ['warehouses'],
  )
}
