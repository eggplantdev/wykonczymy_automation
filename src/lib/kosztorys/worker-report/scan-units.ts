import type { ScanUnitT } from '@/lib/ai/worker-report-scan-schema'
import type { LanguageT } from '@/lib/i18n/languages'
import { translateUnit } from '@/lib/kosztorys/worker-view/translate-unit'

/** The paper shows the worker's j.m.; the model reads it and answers with the Polish value. */
export const scanUnits = (units: Iterable<string>, language: LanguageT): ScanUnitT[] =>
  [...units].map((value) => {
    const translated = translateUnit(value, language)
    return { value, label: translated === value ? value : `${value} — ${translated}` }
  })
