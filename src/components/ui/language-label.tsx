import { LANGUAGE_LABELS, type LanguageT } from '@/lib/i18n/languages'

// Drawn rather than an emoji: Windows renders 🇵🇱 as the letters „PL".
const STRIPES: Record<LanguageT, string[]> = {
  pl: ['bg-white', 'bg-red-600'],
  uk: ['bg-blue-700', 'bg-yellow-400'],
  ru: ['bg-white', 'bg-blue-700', 'bg-red-600'],
}

// The flag is what tells „Українська" from „Русский" to a reader who doesn't read Cyrillic.
export function LanguageLabel({ language }: { language: LanguageT }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="ring-border inline-flex h-3 w-4.5 shrink-0 flex-col overflow-hidden rounded-xs ring-1"
      >
        {STRIPES[language].map((stripe) => (
          <span key={stripe} className={`flex-1 ${stripe}`} />
        ))}
      </span>
      {LANGUAGE_LABELS[language]}
    </span>
  )
}
