'use client'

import { SimpleSelect } from '@/components/ui/simple-select'
import { LanguageLabel } from '@/components/ui/language-label'
import { LANGUAGES, languageSchema, type LanguageT } from '@/lib/i18n/languages'

const OPTIONS = LANGUAGES.map((language) => ({
  value: language,
  label: <LanguageLabel language={language} />,
}))

type PropsT = {
  value: LanguageT
  onValueChange: (language: LanguageT) => void
  disabled?: boolean
}

export function LanguageSelect({ value, onValueChange, disabled }: PropsT) {
  return (
    // On a phone the collapsed trigger shows the flag alone — the name would squeeze the header
    // beside it. The open menu still names every language.
    <SimpleSelect
      variant="toolbar"
      className="max-sm:**:data-[slot=language-name]:sr-only"
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const parsed = languageSchema.safeParse(next)
        if (parsed.success) onValueChange(parsed.data)
      }}
      options={OPTIONS}
    />
  )
}
