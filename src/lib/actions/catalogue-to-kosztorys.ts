'use server'

import { after } from 'next/server'
import type { Payload } from 'payload'
import { z } from 'zod'
import { translateSectionName } from '@/lib/actions/translate-section-name'
import { investmentAction } from '@/lib/actions/investment-action'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { listCatalogueItemsByIds, listCatalogueItemsByMatchKeys } from '@/lib/db/work-catalogue'
import {
  applyCatalogueValues,
  listItemsForCatalogueApply,
  type CatalogueApplyColumnT,
  type CatalogueApplyValueT,
} from '@/lib/db/kosztorys-catalogue-apply'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { catalogueRateFor } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { appendCatalogueItems } from '@/lib/kosztorys/work-catalogue/append-catalogue-items'
import { createSectionWithCatalogueItems } from '@/lib/kosztorys/work-catalogue/create-section-with-catalogue-items'
import type {
  AppendedCatalogueSliceT,
  AppliedCatalogueValueT,
  NewSectionCatalogueSliceT,
  SeedConflictFieldT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'
import { validateAction } from './run-action'

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
      after(() => translateSectionName(payload, parsed.data.sectionName))

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

const TEMPLATE_READS_CATALOGUE = 'Szablon pokazuje ceny prosto z katalogu prac.'

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
    async ({ payload, user, isTemplate }) => {
      // A szablon already reads the katalog's liczby (EX-1017) — there is nothing to take over.
      if (isTemplate) return { success: false, error: TEMPLATE_READS_CATALOGUE }
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

      const byKey = new Map(
        (
          await listCatalogueItemsByMatchKeys(
            db,
            items.map((item) => catalogueKey(item.description, item.unit)),
          )
        ).map((entry) => [entry.matchKey, entry]),
      )

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
