'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { I18nContext } from '@/hooks/use-translation'
import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { LANGUAGES, type LanguageT } from '@/lib/i18n/languages'

type PropsT = {
  initialLocale: LanguageT
  workerId: number
  children: ReactNode
}

export function TranslationsProvider({ initialLocale, workerId, children }: PropsT) {
  // Per worker, not per device: a phone passed between two of the crew must not carry one's choice
  // into the other's link.
  const [storedLocale, storeLocale] = usePersistedEnum(
    `worker-report-lang:${workerId}`,
    LANGUAGES,
    initialLocale,
  )
  // A private window refuses storage; the state still holds the switch for this visit.
  const [chosenLocale, setChosenLocale] = useState<LanguageT>()
  const locale = chosenLocale ?? storedLocale

  // `<html>` belongs to the root layout, which cannot know the worker's language.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = (next: LanguageT) => {
    storeLocale(next)
    setChosenLocale(next)
  }

  return <I18nContext value={{ locale, setLocale }}>{children}</I18nContext>
}
