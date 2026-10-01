'use client'

import { SimpleSelect } from '@/components/ui/simple-select'
import { LanguageLabel } from '@/components/ui/language-label'
import { useI18nContext } from '@/lib/i18n/i18n-context'
import { LANGUAGES, languageSchema } from '@/lib/i18n/languages'

const OPTIONS = LANGUAGES.map((language) => ({
  value: language,
  label: <LanguageLabel language={language} />,
}))

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18nContext()
  return (
    <SimpleSelect
      variant="toolbar"
      value={locale}
      onValueChange={(value) => {
        const parsed = languageSchema.safeParse(value)
        if (parsed.success) setLocale(parsed.data)
      }}
      options={OPTIONS}
    />
  )
}
