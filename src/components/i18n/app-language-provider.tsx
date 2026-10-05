'use client'

import { useEffect, type ReactNode } from 'react'
import { I18nContext } from '@/hooks/use-translation'
import type { LanguageT } from '@/lib/i18n/languages'

type PropsT = {
  locale: LanguageT
  children: ReactNode
}

// The account is the only source: changing it goes through `changeOwnLanguageAction`, whose
// revalidation re-renders the shell with the new locale, so there is nothing for `setLocale` to do.
const noop = () => {}

export function AppLanguageProvider({ locale, children }: PropsT) {
  // `<html>` sits above the Suspense boundary the account read streams into.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <I18nContext value={{ locale, setLocale: noop }}>{children}</I18nContext>
}
