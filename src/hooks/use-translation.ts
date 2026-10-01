'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'
import { createTranslator, type NamespaceT } from '@/lib/i18n/translations'

type I18nContextT = {
  locale: LanguageT
  setLocale: (locale: LanguageT) => void
}

// Polish without a provider, never a throw: the manager's editor renders the same grid components
// the report link does, and it must not need wrapping to keep reading Polish.
export const I18nContext = createContext<I18nContextT>({
  locale: DEFAULT_LANGUAGE,
  setLocale: () => {},
})

export const useI18nContext = () => useContext(I18nContext)

export function useTranslation<NS extends NamespaceT>(namespace: NS) {
  const { locale } = useI18nContext()
  return createTranslator(locale, namespace)
}
