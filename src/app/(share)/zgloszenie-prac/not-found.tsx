import { BrandLogo } from '@/components/ui/brand-logo'
import { LANGUAGES } from '@/lib/i18n/languages'
import { translate } from '@/lib/i18n/translations'

// An unknown token names no worker, so there is no language to pick: every one of the crew's
// languages, each in its own `lang`. Scoped to the report link — the investor's links stay Polish.
export default function ReportNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
      <header className="border-border border-b px-4 py-3 sm:py-5">
        <BrandLogo height={54} priority className="max-sm:h-11" />
      </header>
      <div className="flex flex-col gap-4 px-4 py-10 text-sm">
        {LANGUAGES.map((language) => (
          <p key={language} lang={language}>
            {translate(language, 'notices', 'unknownToken')}
          </p>
        ))}
      </div>
    </main>
  )
}
