'use client'

import { SimpleSelect } from '@/components/ui/simple-select'
import { useI18nContext } from '@/lib/i18n/i18n-context'
import { LANGUAGES, LANGUAGE_LABELS, languageSchema } from '@/lib/i18n/languages'

const OPTIONS = LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_LABELS[language] }))

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18nContext()
  return (
    <SimpleSelect
      variant="pill"
      value={locale}
      onValueChange={(value) => {
        const parsed = languageSchema.safeParse(value)
        if (parsed.success) setLocale(parsed.data)
      }}
      options={OPTIONS}
    />
  )
}
