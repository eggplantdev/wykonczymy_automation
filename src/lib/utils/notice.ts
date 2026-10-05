import { POLISH_GRID, type TranslatorT } from '@/lib/i18n/translations'

// The WORDING and the timing of a notice, kept apart from `toast.ts`, which is the side effect that
// shows one. 22 specs mock that module to keep react-toastify out of jsdom, each factory naming only
// `toastMessage` — so a constant living there came back `undefined` in every one of them. Nothing has
// a reason to mock a string builder.

// Longer than toastMessage's 2s default: a notice fires as the user's eyes are already moving on, and
// it reports a figure that was just committed.
export const NOTICE_MS = 5000

// One sentence for a refused entry, so a grid cell and a settings field word the same refusal. The
// „przywrócono …" half is appended only where the refusal displaced a figure — garbage that displaced
// nothing is reported quietly.
export const rejectedEntryMessage = (
  restored: string | null,
  kind: 'invalid' | 'blocked' = 'invalid',
  dictionary: TranslatorT<'grid'> = POLISH_GRID,
) =>
  `${dictionary.t(kind === 'blocked' ? 'rejectedBlocked' : 'rejectedInvalid')}${
    restored == null ? '' : ` — ${dictionary.t('rejectedRestored', { value: restored })}`
  }.`

// „Uzupełnij tłumaczenia (AI)" on the rozpiska and on the katalog. `sections` is absent on the katalog,
// which has none. Counts sit after a colon, so no Polish plural form is needed.
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

// The manager's „Przetłumacz" on a praca spoza rozpiski. A Polish line or an unchanged answer leaves
// the row looking the same, so without a word the click seems to have done nothing.
export function retranslationNotice(
  before: string | undefined,
  after: string | null,
): { message: string; kind: 'success' | 'info' } {
  if (after === null)
    return { message: 'Pracownik napisał po polsku — nie ma czego tłumaczyć', kind: 'info' }
  if (after === before) return { message: 'Tłumaczenie bez zmian', kind: 'info' }
  return { message: 'Przetłumaczono', kind: 'success' }
}
