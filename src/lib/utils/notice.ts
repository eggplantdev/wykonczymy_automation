import { POLISH_GRID, type TranslatorT } from '@/lib/i18n/translations'

export const NOTICE_MS = 5000

export const rejectedEntryMessage = (
  restored: string | null,
  kind: 'invalid' | 'blocked' = 'invalid',
  dictionary: TranslatorT<'grid'> = POLISH_GRID,
) =>
  `${dictionary.t(kind === 'blocked' ? 'rejectedBlocked' : 'rejectedInvalid')}${
    restored == null ? '' : ` — ${dictionary.t('rejectedRestored', { value: restored })}`
  }.`

export const SAVED_UNTRANSLATED_WARNING = 'Zapisano bez tłumaczenia.'

export function translationFillNotice(result: {
  items: number
  sections?: number
  failed: number
}): { message: string; kind: 'success' | 'warning' | 'info' } {
  const { items, sections, failed } = result
  if (items === 0 && !sections && failed === 0)
    return { message: 'Wszystko jest już przetłumaczone', kind: 'info' }
  const done = [`opisy: ${items}`, ...(sections === undefined ? [] : [`nazwy sekcji: ${sections}`])]
  const message = `Przetłumaczono ${done.join(', ')}`
  if (failed === 0) return { message, kind: 'success' }
  return { message: `${message} — nie udało się: ${failed}. Spróbuj ponownie.`, kind: 'warning' }
}

export function retranslationNotice(
  before: string | undefined,
  after: string | null,
): { message: string; kind: 'success' | 'info' } {
  if (after === null)
    return { message: 'Pracownik napisał po polsku — nie ma czego tłumaczyć', kind: 'info' }
  if (after === before) return { message: 'Tłumaczenie bez zmian', kind: 'info' }
  return { message: 'Przetłumaczono', kind: 'success' }
}
