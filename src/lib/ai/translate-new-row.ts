import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import {
  aiFillWrites,
  mergeRowWrites,
  planAiFill,
  type FillRowT,
} from '@/lib/i18n/ai-translation-fill'
import { logError } from '@/lib/utils/log-error'
import { translateTexts } from './translate'

export const SAVED_UNTRANSLATED_WARNING = 'Zapisano bez tłumaczenia.'

/**
 * The languages a row being created still lacks: from the katalog first, then the AI. Runs before
 * the insert transaction opens, and a failure leaves those languages empty rather than failing the
 * save — the row then shows up under Problemy like any other untranslated one.
 */
export async function translateNewRow(
  row: Omit<FillRowT, 'id'>,
  catalogueByKey: ReadonlyMap<string, DescriptionTranslationsT> = new Map(),
): Promise<{ translations: DescriptionTranslationsT; failed: boolean }> {
  const plan = planAiFill([{ ...row, id: 0 }], catalogueByKey)
  let ai: Awaited<ReturnType<typeof translateTexts>> = new Map()
  if (plan.toTranslate.length > 0) {
    try {
      ai = await translateTexts(plan.toTranslate.map(({ text }) => text))
    } catch (error) {
      logError('translateNewRow', error)
    }
  }
  const { writes, failed } = aiFillWrites(plan.toTranslate, ai)
  const [filled] = mergeRowWrites([...plan.fromCatalogue, ...writes])
  return {
    translations: { ...row.translations, ...filled?.translations },
    failed: failed > 0,
  }
}
