import { z } from 'zod'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { MAX_SCAN_PHOTOS } from '@/lib/kosztorys/worker-report/constants'

// A `'use server'` module can export only async functions.

const idSchema = z.number().int().positive()

const reportQtySchema = z.number().positive(pl.notices.qtyPositive)

// A rozpiska line names only its pozycja — opis, j.m. and sekcja are copied on the server from the
// live pozycja, never taken from the client.
export const sendLineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rozpiska'),
    itemId: idSchema,
    qty: reportQtySchema,
  }),
  z.object({
    kind: z.literal('extra'),
    description: z.string().trim().min(1, pl.notices.extraDescription).max(1000),
    unit: z.string().trim().min(1, pl.notices.extraUnit).max(40),
    qty: reportQtySchema,
  }),
])

export const acceptSchema = z
  .object({
    investmentId: idSchema,
    reportId: idSchema,
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('stage'), stageId: idSchema }),
      z.object({ kind: z.literal('new'), plane: z.enum(TOOL_PLANES).optional() }),
    ]),
    lines: z.array(
      z.object({
        lineId: idSchema,
        acceptedQty: reportQtySchema,
        itemId: idSchema.optional(),
        seenQty: reportQtySchema.optional(),
      }),
    ),
    undone: z.array(idSchema),
    rejected: z.array(idSchema),
    unrejected: z.array(idSchema),
  })
  .refine(
    (input) =>
      input.lines.length + input.undone.length + input.rejected.length + input.unrejected.length >
      0,
    { message: 'Nic się nie zmieniło' },
  )

const scanQtySchema = z.number().nullable()

export const scanPageSchema = z.object({
  rows: z.array(
    z.object({
      ref: z.string().trim().min(1).max(40),
      qty: scanQtySchema,
      isUncertain: z.boolean(),
      description: z.string().max(1000).optional(),
    }),
  ),
  extras: z.array(
    z.object({
      description: z.string().max(1000),
      unit: z.string().max(40).nullable(),
      qty: scanQtySchema,
      isUncertain: z.boolean(),
    }),
  ),
})

export const createScannedReportSchema = z.object({
  investmentId: idSchema,
  workerId: idSchema,
  pages: z.array(scanPageSchema).min(1).max(MAX_SCAN_PHOTOS),
  mediaIds: z
    .array(idSchema)
    .min(1)
    .max(MAX_SCAN_PHOTOS)
    .refine((ids) => new Set(ids).size === ids.length, 'Zdjęcie powtarza się w zgłoszeniu'),
})
