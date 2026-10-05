import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import {
  aiFillWrites,
  planAiFill,
  type FillRowT,
  type RowWriteT,
} from '@/lib/i18n/ai-translation-fill'
import { logError } from '@/lib/utils/log-error'
import { translateTexts } from './translate'

// Katalog first, then one AI call for what is still missing. Never rejects: a failed batch comes back
// as `failed` pairs, not as a throw.
export async function translateRows(
  rows: readonly FillRowT[],
  catalogueByKey: ReadonlyMap<string, DescriptionTranslationsT> = new Map(),
): Promise<{ writes: RowWriteT[]; failed: number }> {
  const plan = planAiFill(rows, catalogueByKey)
  const ai = await translateTexts(plan.toTranslate.map(({ text }) => text))
  const { writes, failed } = aiFillWrites(plan.toTranslate, ai)
  return { writes: [...plan.fromCatalogue, ...writes], failed }
}

// Runs before the insert transaction opens. A failure leaves those languages empty rather than
// failing the save — the row then shows up under Problemy like any other untranslated one. The catch
// keeps that promise without leaning on `translateTexts` swallowing every failure itself.
export async function translateNewRow(
  row: Omit<FillRowT, 'id'>,
  catalogueByKey?: ReadonlyMap<string, DescriptionTranslationsT>,
): Promise<{ translations: DescriptionTranslationsT; failed: boolean }> {
  const { writes, failed } = await translateRows([{ ...row, id: 0 }], catalogueByKey).catch(
    (error: unknown) => {
      logError('translateNewRow', error)
      return { writes: [], failed: 1 }
    },
  )
  return {
    translations: Object.assign(
      {},
      row.descriptionTranslations,
      ...writes.map((write) => write.translations),
    ),
    failed: failed > 0,
  }
}
