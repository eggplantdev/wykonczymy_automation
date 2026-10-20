import { SHOWCASE_SECTIONS } from './showcase-sections'

export function ShowcaseToc() {
  return (
    <nav className="sticky top-0 hidden w-48 shrink-0 self-start py-4 sm:block">
      <ul className="flex flex-col gap-1 text-sm">
        {SHOWCASE_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-muted-foreground hover:text-foreground hover:bg-accent block rounded-md px-2 py-1"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
