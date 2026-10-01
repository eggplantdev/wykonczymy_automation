import type { LanguageT } from '@/lib/i18n/languages'

// Drawn rather than an emoji: Windows renders 🇵🇱 as the letters „PL".
const STRIPES: Record<LanguageT, string[]> = {
  pl: ['bg-white', 'bg-red-600'],
  uk: ['bg-blue-700', 'bg-yellow-400'],
  ru: ['bg-white', 'bg-blue-700', 'bg-red-600'],
}

export function LanguageFlag({ language }: { language: LanguageT }) {
  return (
    <span
      aria-hidden
      className="ring-border inline-flex h-3 w-4.5 shrink-0 flex-col overflow-hidden rounded-xs ring-1"
    >
      {STRIPES[language].map((stripe) => (
        <span key={stripe} className={`flex-1 ${stripe}`} />
      ))}
    </span>
  )
}
