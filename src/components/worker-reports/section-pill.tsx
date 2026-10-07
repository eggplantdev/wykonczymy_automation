// Reads `--section-rail` from the row, so the pill takes the same colour as the rail beside it.
export function SectionPill({ name }: { name: string }) {
  return (
    <span className="worker-report-section inline-block max-w-40 truncate rounded px-1.5 py-0.5 text-xs font-medium max-sm:max-w-24">
      {name}
    </span>
  )
}
