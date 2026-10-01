'use client'

import { SimpleSelect } from '@/components/ui/simple-select'
import { LanguageLabel } from '@/components/ui/language-label'
import { useI18nContext } from '@/hooks/use-translation'
import { LANGUAGES, languageSchema } from '@/lib/i18n/languages'

const OPTIONS = LANGUAGES.map((language) => ({
  value: language,
  label: <LanguageLabel language={language} />,
}))

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18nContext()
  return (
    // On a phone the collapsed trigger shows the flag alone — the name would squeeze the inwestycja
    // and pracownik out of the header. The open menu still names every language.
    <SimpleSelect
      variant="toolbar"
      className="max-sm:**:data-[slot=language-name]:sr-only"
      value={locale}
      onValueChange={(value) => {
        const parsed = languageSchema.safeParse(value)
        if (parsed.success) setLocale(parsed.data)
      }}
      options={OPTIONS}
    />
  )
}
