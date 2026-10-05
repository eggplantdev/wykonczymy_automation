'use client'

import { LanguageSelect } from '@/components/ui/language-select'
import { useI18nContext } from '@/hooks/use-translation'

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18nContext()
  return <LanguageSelect value={locale} onValueChange={setLocale} />
}
