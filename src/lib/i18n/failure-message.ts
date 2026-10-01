import { pl } from '@/lib/i18n/dictionaries/pl'
import type { LanguageT } from '@/lib/i18n/languages'
import { isMessageKey, translate, type MessageKeyT } from '@/lib/i18n/translations'
import type { FailureT } from '@/types/action'

function commonKeyOf(failure: FailureT): MessageKeyT<'common'> {
  if (failure.code === 'REQUEST_FAILED') return 'requestFailed'
  if (failure.code === 'NOT_FOUND') return 'staleRow'
  if (failure.error === pl.common.databaseError) return 'databaseError'
  return 'genericError'
}

// Polish reads `error` as sent, so the manager-facing wording is never second-guessed. Any other
// language gets the keyed sentence, or the generic one: a raw exception message is Polish or English
// developer text, and showing it to a worker who reads neither explains nothing.
export function failureMessage(locale: LanguageT, failure: FailureT): string {
  if (locale === 'pl') return failure.error
  if (isMessageKey('notices', failure.messageKey)) {
    return translate(locale, 'notices', failure.messageKey)
  }
  return translate(locale, 'common', commonKeyOf(failure))
}
