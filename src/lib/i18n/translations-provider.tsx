'use client'

import { useEffect, useState, type ReactNode } from 'react'
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

export function TranslationsProvider({ initialLocale, workerId, children }: PropsT) {
  const [locale, setLocaleState] = useState(initialLocale)

  // After mount, not in the initial state: the server renders the stored language, and reading
  // storage during render would hydrate a different tree than it sent.
  useEffect(() => {
    const stored = readStoredLocale(workerId)
    if (stored) setLocaleState(stored)
  }, [workerId])

  // `<html>` belongs to the root layout, which cannot know the worker's language.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = (next: LanguageT) => {
    storeLocale(workerId, next)
    setLocaleState(next)
  }

  return <I18nContext value={{ locale, setLocale }}>{children}</I18nContext>
}
