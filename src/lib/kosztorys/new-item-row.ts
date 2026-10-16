import 'server-only'
import type { Payload } from 'payload'
import { translateNewRow } from '@/lib/ai/translate-new-row'
import { getDb } from '@/lib/db/get-db'
import { ceilingWarnings } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import { catalogueTranslationsFor } from '@/lib/kosztorys/work-catalogue/catalogue-translations-for'
import { EMPTY_ITEM_TEXT_ERROR } from '@/lib/kosztorys/work-catalogue/template-catalogue-patch'
import { catalogueRow } from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import { SAVED_UNTRANSLATED_WARNING } from '@/lib/utils/notice'
import type { ActionResultT, FailureT } from '@/types/action'

type NewItemRowT = ReturnType<typeof catalogueRow> & {
  descriptionTranslations: Awaited<ReturnType<typeof translateNewRow>>['translations']
}

// „Dodaj pracę" on either plane, before its transaction: the translation is an AI call, so it runs
// outside the write.
export async function prepareNewItemRow(
  payload: Payload,
  data: Parameters<typeof catalogueRow>[0],
  translate = false,
): Promise<FailureT | { row: NewItemRowT; translationFailed: boolean }> {
  const fields = catalogueRow(data)
  if (!fields.description || !fields.unit) {
    return { success: false, error: EMPTY_ITEM_TEXT_ERROR }
  }
  const translated = translate
    ? await translateNewRow(
        { description: fields.description, unit: fields.unit, descriptionTranslations: {} },
        await catalogueTranslationsFor(await getDb(payload), fields.matchKey),
      )
    : { translations: {}, failed: false }
  return {
    row: { ...fields, descriptionTranslations: translated.translations },
    translationFailed: translated.failed,
  }
}

export function addedItemResult(
  item: KosztorysItemT,
  id: number,
  translationFailed: boolean,
): ActionResultT<{ item: KosztorysItemT }> {
  const warnings = [
    ...ceilingWarnings([item]),
    ...(translationFailed ? [SAVED_UNTRANSLATED_WARNING] : []),
  ]
  return {
    success: true,
    data: { item: { ...item, id } },
    ...(warnings.length > 0 && { warning: warnings.join(' ') }),
  }
}
