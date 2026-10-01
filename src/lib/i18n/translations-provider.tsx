'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { I18nContext } from '@/lib/i18n/i18n-context'
import { languageSchema, type LanguageT } from '@/lib/i18n/languages'

const storageKey = (workerId: number) => `worker-report-lang:${workerId}`

// Per worker, not per device: a phone passed between two of the crew must not carry one's choice
// into the other's link.
function readStoredLocale(workerId: number): LanguageT | undefined {
  try {
    const parsed = languageSchema.safeParse(window.localStorage.getItem(storageKey(workerId)))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

function storeLocale(workerId: number, locale: LanguageT) {
  try {
    window.localStorage.setItem(storageKey(workerId), locale)
  } catch {
    // A private window refuses storage; the switch still holds for this visit.
  }
}

type PropsT = {
  initialLocale: LanguageT
  workerId: number
  children: ReactNode
}

const subscribeToNothing = () => () => {}

export function TranslationsProvider({ initialLocale, workerId, children }: PropsT) {
  // The server snapshot is `undefined`: hydration matches the server's render in the worker's saved
  // language, and only then switches to the choice this browser remembers.
  const storedLocale = useSyncExternalStore(
    subscribeToNothing,
    () => readStoredLocale(workerId),
    () => undefined,
  )
  const [chosenLocale, setChosenLocale] = useState<LanguageT>()
  const locale = chosenLocale ?? storedLocale ?? initialLocale

  // `<html>` belongs to the root layout, which cannot know the worker's language.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = (next: LanguageT) => {
    storeLocale(workerId, next)
    setChosenLocale(next)
  }

  return <I18nContext value={{ locale, setLocale }}>{children}</I18nContext>
}
