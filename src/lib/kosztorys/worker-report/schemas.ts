import { z } from 'zod'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { MAX_SCAN_PHOTOS } from '@/lib/kosztorys/worker-report/constants'

// Beside the types, not in the actions: a `'use server'` module can export only async functions.

const idSchema = z.number().int().positive()

// The worker's send and the kierownik's accept refuse a non-positive ilość with one sentence. The
// worker-facing sentences come from the dictionary, so the send action can name their key.
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

export const reportIdSchema = idSchema

export const acceptSchema = z
  .object({
    investmentId: idSchema,
    reportId: idSchema,
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('stage'), stageId: idSchema }),
      z.object({ kind: z.literal('new'), plane: z.enum(TOOL_PLANES).optional() }),
    ]),
    // New lines, and accepted ones whose ilość changed. `itemId` only for a line re-pointed by hand
    // after its pozycja was deleted; `seenQty` is the przyjęta ilość the window loaded, absent for a
    // line it saw open.
    lines: z.array(
      z.object({
        lineId: idSchema,
        acceptedQty: reportQtySchema,
        itemId: idSchema.optional(),
        seenQty: reportQtySchema.optional(),
      }),
    ),
    extras: z.array(
      z.object({
        lineId: idSchema,
        acceptedQty: reportQtySchema,
        sectionId: idSchema,
        clientPrice: z.number().min(0).optional(),
        catalogueItemId: idSchema.optional(),
      }),
    ),
    // Accepted lines the kierownik unticked: their ilość comes back out of the etap.
    undone: z.array(idSchema),
  })
  .refine((input) => input.lines.length + input.extras.length + input.undone.length > 0, {
    message: 'Nic się nie zmieniło',
  })

const scanQtySchema = z.number().nullable()

// What one photo reads as. The ref stays the printed text — check digit included — so the resolver,
// not the AI, decides whether it names a pozycja.
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
