import { foldUnit } from '@/lib/kosztorys/fold'
import type { LanguageT, TranslationLanguageT } from '@/lib/i18n/languages'
import { cleanUnit } from '@/lib/kosztorys/clean-unit'

// Keyed by fold, so `m2` / `m²` / `M2`, `klp` / `kpl` and `szt` / `szt.` land on one entry.
const UNIT_TRANSLATIONS: Readonly<Record<string, Record<TranslationLanguageT, string>>> = {
  szt: { uk: 'шт.', ru: 'шт.' },
  m2: { uk: 'м²', ru: 'м²' },
  m3: { uk: 'м³', ru: 'м³' },
  mb: { uk: 'пог. м', ru: 'пог. м' },
  kpl: { uk: 'компл.', ru: 'компл.' },
  pkt: { uk: 'точ.', ru: 'точ.' },
  kontener: { uk: 'контейнер', ru: 'контейнер' },
  kg: { uk: 'кг', ru: 'кг' },
  h: { uk: 'год.', ru: 'ч' },
  godz: { uk: 'год.', ru: 'ч' },
}

// Polish stays exactly as the owner typed it — the link and the paper show what is in the rozpiska.
export function translateUnit(unit: string, locale: LanguageT): string {
  if (locale === 'pl') return unit
  return UNIT_TRANSLATIONS[foldUnit(cleanUnit(unit))]?.[locale] ?? unit
}
