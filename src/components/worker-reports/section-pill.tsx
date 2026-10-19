// Reads `--section-rail` from the row, so the pill takes the same colour as the rail beside it.
export function SectionPill({ name }: { name: string }) {
  return (
    <span className="inline-block max-w-40 truncate rounded bg-(--section-rail,var(--color-muted-foreground))/18 px-1.5 py-0.5 text-xs font-medium text-[color-mix(in_oklab,var(--section-rail,var(--color-muted-foreground))_45%,var(--color-foreground))] max-sm:max-w-24">
      {name}
    </span>
  )
}
