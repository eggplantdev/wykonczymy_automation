'use server'

import type { Payload } from 'payload'
import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  findCatalogueItemByKey,
  getCatalogueSourceItem,
  listCatalogueItems,
  listCatalogueItemsByIds,
} from '@/lib/db/work-catalogue'
import {
  applyCatalogueValues,
  listItemsForCatalogueApply,
  type CatalogueApplyColumnT,
  type CatalogueApplyValueT,
} from '@/lib/db/kosztorys-catalogue-apply'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { catalogueRateFor } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { appendCatalogueItems } from '@/lib/kosztorys/work-catalogue/append-catalogue-items'
import { createSectionWithCatalogueItems } from '@/lib/kosztorys/work-catalogue/create-section-with-catalogue-items'
import type {
  AppendedCatalogueSliceT,
  AppliedCatalogueValueT,
  CatalogueSavePreviewT,
  CatalogueSeedItemT,
  NewSectionCatalogueSliceT,
  SeedConflictFieldT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'
import {
  workCatalogueItemSchema,
  type WorkCatalogueItemDataT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { protectedAction, validateAction } from './run-action'

const MISSING_ITEM_ERROR = 'Nie znaleziono pozycji'

const DUPLICATE_ERROR = 'Praca o tej nazwie i jednostce już jest w katalogu.'

// `matchKey` is computed here and nowhere else — the UNIQUE index only means something if the value
// it guards comes from the same folding every reader uses.
const toRow = (data: WorkCatalogueItemDataT) => ({
  description: data.description.trim(),
  category: data.category.trim() || null,
  unit: data.unit.trim(),
  clientPrice: data.clientPrice,
  wToolsRate: data.wToolsRate,
  wToolsRateCoeff: data.wToolsRateCoeff,
  ownToolsRate: data.ownToolsRate,
  ownToolsRateCoeff: data.ownToolsRateCoeff,
  matchKey: catalogueKey(data.description, data.unit),
})

export async function createCatalogueItemAction(data: WorkCatalogueItemDataT) {
  return protectedAction(
    'createCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = toRow(parsed.data)

      // The unique index would refuse it anyway, but a Polish sentence beats a driver error — and
      // this is the ordinary path: the katalog exists to be typed into twice.
      const existing = await payload.find({
        collection: 'work-catalogue-items',
        where: { matchKey: { equals: row.matchKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { success: false, error: DUPLICATE_ERROR }

      await payload.create({ collection: 'work-catalogue-items', data: row })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function updateCatalogueItemAction(id: number, data: WorkCatalogueItemDataT) {
  return protectedAction(
    'updateCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = toRow(parsed.data)

      // Editing the opis or j.m. re-derives the key, so an edit can collide exactly like a create.
      // The row being edited is excluded — otherwise saving it unchanged would collide with itself.
      const existing = await payload.find({
        collection: 'work-catalogue-items',
        where: { and: [{ matchKey: { equals: row.matchKey } }, { id: { not_equals: id } }] },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { success: false, error: DUPLICATE_ERROR }

      await payload.update({ collection: 'work-catalogue-items', id, data: row })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function deleteCatalogueItemAction(id: number) {
  return protectedAction(
    'deleteCatalogueItemAction',
    async ({ payload }) => {
      // Prace copy the numbers at insert time and freeze them, so a delete can't orphan a kosztorys.
      await payload.delete({ collection: 'work-catalogue-items', id })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

const catalogueItemIdsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Wybierz co najmniej jedną pracę')

const insertCatalogueItemsSchema = z.object({
  sectionId: z.number().int().positive(),
  catalogueItemIds: catalogueItemIdsSchema,
})

const createSectionWithCatalogueItemsSchema = z.object({
  investmentId: z.number().int().positive(),
  sectionName: z.string().trim().min(1, 'Podaj nazwę sekcji'),
  catalogueItemIds: catalogueItemIdsSchema,
})

// The client sends ONLY ids: every number that lands in the rozpiska is re-read from the cennik
// server-side, so a tampered payload cannot price a praca.
async function readCatalogueItems(
  payload: Payload,
  catalogueItemIds: number[],
): Promise<WorkCatalogueItemT[] | { error: string }> {
  const db = await getDb(payload)
  // Before the existence check: `listCatalogueItemsByIds` returns one row per REQUESTED id, so
  // `[5, 5, 5]` would pass the length test and append the same praca three times.
  const ids = [...new Set(catalogueItemIds)]
  const items = await listCatalogueItemsByIds(db, ids)
  if (items.length !== ids.length)
    return { error: 'Część wybranych prac nie istnieje już w katalogu.' }
  return items
}

export async function insertCatalogueItemsAction(
  sectionId: number,
  catalogueItemIds: number[],
): Promise<ActionResultT<AppendedCatalogueSliceT>> {
  return investmentAction(
    'insertCatalogueItemsAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(insertCatalogueItemsSchema, { sectionId, catalogueItemIds })
      if (!parsed.success) return parsed

      const items = await readCatalogueItems(payload, parsed.data.catalogueItemIds)
      if ('error' in items) return { success: false, error: items.error }

      const created = await withPayloadTransaction(
        payload,
        (req) => appendCatalogueItems(payload, req, parsed.data.sectionId, items),
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: 'Nie znaleziono sekcji' }

      return { success: true, data: created }
    },
    ['kosztorysItems'],
  )
}

// The sekcja and the prace are written together, so „Anuluj" in the picker can never leave an orphan
// sekcja behind.
export async function createSectionWithCatalogueItemsAction(
  investmentId: number,
  sectionName: string,
  catalogueItemIds: number[],
): Promise<ActionResultT<NewSectionCatalogueSliceT>> {
  return investmentAction(
    'createSectionWithCatalogueItemsAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(createSectionWithCatalogueItemsSchema, {
        investmentId,
        sectionName,
        catalogueItemIds,
      })
      if (!parsed.success) return parsed

      const items = await readCatalogueItems(payload, parsed.data.catalogueItemIds)
      if ('error' in items) return { success: false, error: items.error }

      const created = await withPayloadTransaction(
        payload,
        (req) =>
          createSectionWithCatalogueItems(
            payload,
            req,
            parsed.data.investmentId,
            parsed.data.sectionName,
            items,
          ),
        { skipRevalidation: true },
      )

      return { success: true, data: created }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

const applyCatalogueSchema = z.object({
  investmentId: z.number().int().positive(),
  selections: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        fields: z
          .array(z.enum(['clientPrice', 'wToolsRate', 'ownToolsRate']))
          .min(1, 'Zaznacz co najmniej jedną liczbę'),
      }),
    )
    .min(1, 'Zaznacz co najmniej jedną liczbę'),
})

const STALE_ITEM_ERROR = 'Część zaznaczonych pozycji już nie istnieje.'
const STALE_CATALOGUE_ERROR = 'Część zaznaczonych prac nie jest już w katalogu.'

// Taking a stawka means taking its ŹRÓDŁO, so BOTH kolumny of that płaszczyzna are written and one of
// them lands as `null`. Writing only the column the katalog names would leave the pozycja's old
// nadpisanie standing beside the new one, and the rozpiska reads such a pair as the OTHER źródło —
// a mnożnik outranks a kwota, so „weź kwotę z katalogu" would have changed nothing on screen.
const RATE_COLUMNS = [
  ['wToolsRate', { plane: 'w_tools', value: 'wToolsOverrideValue', coeff: 'wToolsOverrideCoeff' }],
  [
    'ownToolsRate',
    { plane: 'own_tools', value: 'ownToolsOverrideValue', coeff: 'ownToolsOverrideCoeff' },
  ],
] as const

/**
 * The other direction: the katalog's liczby taken INTO the rozpiska, for every pozycja and every
 * liczba the owner ticked in „Porównaj z katalogiem prac".
 *
 * The wire carries ids and field names only. Every kwota that lands in the rozpiska is re-read from
 * the cennik here — same rule as `insertCatalogueItemsAction` — and the klucz is rebuilt from the
 * pozycja as it stands NOW rather than taken from the payload, so a window left open across a rename
 * ends in a Polish sentence instead of pricing a praca off the wrong wpis.
 *
 * Snapshots first: the write flattens hand-typed ceny and nadpisania across the whole rozpiska at
 * once and is irrecoverable by in-session undo — the same reason „Popraw literówki" and the rabat
 * procentowy snapshot.
 */
export async function applyCatalogueToKosztorysAction(
  investmentId: number,
  selections: { itemId: number; fields: SeedConflictFieldT[] }[],
): Promise<ActionResultT<AppliedCatalogueValueT[]>> {
  return investmentAction(
    'applyCatalogueToKosztorysAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(applyCatalogueSchema, { investmentId, selections })
      if (!parsed.success) return parsed

      // Folded per pozycja before anything reads the DB: a payload naming one praca twice would
      // otherwise push the same id into a batch twice, and `UPDATE … FROM (VALUES …)` has no
      // opinion about which of the two duplicate rows wins.
      const wanted = new Map<number, Set<SeedConflictFieldT>>()
      for (const selection of parsed.data.selections) {
        const fields = wanted.get(selection.itemId) ?? new Set<SeedConflictFieldT>()
        for (const field of selection.fields) fields.add(field)
        wanted.set(selection.itemId, fields)
      }

      const db = await getDb(payload)
      const items = await listItemsForCatalogueApply(db, investmentId, [...wanted.keys()])
      if (items.length !== wanted.size) return { success: false, error: STALE_ITEM_ERROR }

      const byKey = new Map((await listCatalogueItems(db)).map((entry) => [entry.matchKey, entry]))

      const batches: Record<CatalogueApplyColumnT, CatalogueApplyValueT[]> = {
        clientPrice: [],
        wToolsOverrideValue: [],
        ownToolsOverrideValue: [],
        wToolsOverrideCoeff: [],
        ownToolsOverrideCoeff: [],
      }
      const applied: AppliedCatalogueValueT[] = []

      for (const item of items) {
        const fields = wanted.get(item.id)
        if (!fields) continue
        const entry = byKey.get(catalogueKey(item.description, item.unit))
        if (!entry) return { success: false, error: STALE_CATALOGUE_ERROR }

        const row: AppliedCatalogueValueT = { itemId: item.id }
        if (fields.has('clientPrice')) {
          batches.clientPrice.push({ id: item.id, value: entry.clientPrice })
          row.clientPrice = entry.clientPrice
        }
        for (const [field, columns] of RATE_COLUMNS) {
          if (!fields.has(field)) continue
          const rate = catalogueRateFor(entry, columns.plane)
          batches[columns.value].push({ id: item.id, value: rate.rate })
          batches[columns.coeff].push({ id: item.id, value: rate.coeff })
          row[columns.value] = rate.rate
          row[columns.coeff] = rate.coeff
        }
        applied.push(row)
      }

      // One transaction, because the pair „kwota albo mnożnik" spans two of these batches (EX-865).
      // Five sequential UPDATE-y mean a connection dropped after the `*OverrideValue` batch and
      // before the `*OverrideCoeff` one leaves a pozycja carrying BOTH — and coeff outranks kwota, so
      // the rozpiska quietly prices off the old mnożnik. The snapshot joins the same transaction: a
      // rollback that left it standing would offer an undo to a state nothing changed from.
      await withPayloadTransaction(
        payload,
        async (req) => {
          const tx = await getDb(payload, req)
          await captureAutoSnapshot(tx, investmentId, user.id)
          for (const column of Object.keys(batches) as CatalogueApplyColumnT[])
            await applyCatalogueValues(tx, investmentId, column, batches[column])
        },
        { skipRevalidation: true },
      )

      return { success: true, data: applied }
    },
    ['kosztorysItems'],
  )
}

const EMPTY_DESCRIPTION_ERROR = 'Praca bez opisu nie trafi do katalogu — najpierw ją nazwij.'
// The j.m. is half the klucz, so without this the save died on Payload's own validation and the
// owner got a framework sentence instead of the fix.
const EMPTY_UNIT_ERROR = 'Praca bez jednostki miary nie trafi do katalogu — najpierw uzupełnij j.m.'

// Both „Zapisz do katalogu…" paths start here, with the numbers derived from the pozycja in the DB
// and never from the wire, so the dialog's preview and the save cannot disagree.
async function catalogueSaveState(
  payload: Payload,
  itemId: number,
): Promise<CatalogueSavePreviewT | { error: string }> {
  const db = await getDb(payload)
  const source = await getCatalogueSourceItem(db, itemId)
  if (!source) return { error: MISSING_ITEM_ERROR }

  const candidate = toCatalogueCandidate(source)
  const existing = await findCatalogueItemByKey(db, candidate.matchKey)
  return { candidate, existing: existing ?? null }
}

// Only the BLIND save refuses an incomplete praca — it writes the candidate verbatim, so a missing
// j.m. would die on Payload's own validation and hand the owner a framework sentence. The preview
// deliberately does not: the form it fills is the place where the missing j.m. gets typed in, and
// refusing there would be an error message with nowhere to go and fix it.
function incompleteCandidateError(candidate: CatalogueSeedItemT): string | null {
  if (!candidate.description) return EMPTY_DESCRIPTION_ERROR
  if (!candidate.unit) return EMPTY_UNIT_ERROR
  return null
}

// Fetch-on-open for the dialog: what would be written, and what is already there under that klucz.
export async function catalogueSavePreviewAction(
  itemId: number,
): Promise<ActionResultT<CatalogueSavePreviewT>> {
  return protectedAction('catalogueSavePreviewAction', async ({ payload }) => {
    const state = await catalogueSaveState(payload, itemId)
    if ('error' in state) return { success: false, error: state.error }

    return { success: true, data: state }
  })
}

const saveItemToCatalogueSchema = z.object({
  itemId: z.number().int().positive(),
  mode: z.enum(['new', 'overwrite']),
  keepCatalogueCategory: z.boolean(),
})

// `'overwrite'` updates the row holding the klucz in place — same id, same `created_at` — because
// the katalog entry is the same praca, re-priced.
//
// `keepCatalogueCategory` defaults to protecting the cennik: the candidate's kategoria comes from
// THIS kosztorys' sekcja, one investment's local context, while the katalog owns its own.
export async function saveItemToCatalogueAction(
  itemId: number,
  mode: 'new' | 'overwrite',
  keepCatalogueCategory = true,
) {
  return protectedAction(
    'saveItemToCatalogueAction',
    async ({ payload }) => {
      const parsed = validateAction(saveItemToCatalogueSchema, {
        itemId,
        mode,
        keepCatalogueCategory,
      })
      if (!parsed.success) return parsed

      const state = await catalogueSaveState(payload, parsed.data.itemId)
      if ('error' in state) return { success: false, error: state.error }

      const { candidate, existing } = state
      const incomplete = incompleteCandidateError(candidate)
      if (incomplete) return { success: false, error: incomplete }

      if (parsed.data.mode === 'overwrite') {
        // Deleted between opening the dialog and confirming: the overwrite IS a create, and refusing
        // it would be pedantry about a race nobody caused.
        if (!existing) {
          await payload.create({ collection: 'work-catalogue-items', data: candidate })
          return { success: true }
        }
        await payload.update({
          collection: 'work-catalogue-items',
          id: existing.id,
          data: parsed.data.keepCatalogueCategory
            ? { ...candidate, category: existing.category }
            : candidate,
        })
        return { success: true }
      }

      if (existing) return { success: false, error: DUPLICATE_ERROR }

      await payload.create({ collection: 'work-catalogue-items', data: candidate })

      return { success: true }
    },
    ['workCatalogue'],
  )
}
