import { isLanguage, LANGUAGE_SHORT } from '@/lib/i18n/languages'

const languageShort = (language: string | undefined) =>
  isLanguage(language) ? LANGUAGE_SHORT[language] : 'inny język'

type PropsT = { description: string | undefined; language: string | undefined }

export function WorkerDescription({ description, language }: PropsT) {
  if (description === undefined) return null
  return (
    <span className="block leading-snug">
      <span className="text-muted-foreground text-xs">{languageShort(language)}</span> {description}
    </span>
  )
}
