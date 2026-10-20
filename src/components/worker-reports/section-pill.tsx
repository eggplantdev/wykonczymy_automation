import { Badge } from '@/components/ui/badge'

// Reads `--section-rail` from the row, so the pill takes the same colour as the rail beside it.
export function SectionPill({ name }: { name: string }) {
  return (
    <Badge tone="section" className="inline-block max-w-40 truncate rounded max-sm:max-w-24">
      {name}
    </Badge>
  )
}
