import { TriangleAlert } from 'lucide-react'

export function TemplateCatalogueBanner() {
  return (
    <p
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-amber-400 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      <span>
        Pozycje szablonu to wpisy z katalogu prac. Edycja pozycji tutaj zmienia ją w katalogu prac i
        w każdym innym szablonie z tą pracą. Kosztorysy inwestycji się nie zmieniają.
      </span>
    </p>
  )
}
