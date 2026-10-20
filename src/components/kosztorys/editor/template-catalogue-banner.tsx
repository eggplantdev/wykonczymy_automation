import { TriangleAlert } from 'lucide-react'

export function TemplateCatalogueBanner() {
  return (
    <p
      role="status"
      className="border-warning bg-warning/10 text-warning flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs font-semibold"
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      <span>
        Pozycje szablonu to wpisy z katalogu prac. Edycja pozycji tutaj zmienia ją w katalogu prac i
        w każdym innym szablonie z tą pracą. Kosztorysy inwestycji się nie zmieniają.
      </span>
    </p>
  )
}
