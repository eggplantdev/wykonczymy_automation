import { createColumnHelper } from '@tanstack/react-table'
import { SectionPill } from '@/components/kosztorys/worker-report/section-pill'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'

type SectionedRowT = { description: string; sectionName: string; sectionOrder: number }

// Shared by the worker's form and the manager's review, so a pozycja reads the same on both sides.
export function sectionColumn<RowT extends SectionedRowT>() {
  // Sorted by the rozpiska's own section order, not alphabetically — that is the order both people know.
  return createColumnHelper<RowT>().accessor((row) => row.sectionOrder, {
    id: 'section',
    header: 'Sekcja',
    cell: ({ row }) => <SectionPill name={row.original.sectionName} />,
  })
}

export function descriptionColumn<RowT extends { description: string }>(
  noteOf?: (row: RowT) => string | undefined,
) {
  return createColumnHelper<RowT>().accessor((row) => row.description, {
    id: 'description',
    header: 'Opis prac',
    sortingFn: (first, second) =>
      compareDescriptions(first.original.description, second.original.description),
    meta: { fill: true },
    cell: ({ row }) => {
      const note = noteOf?.(row.original)
      return (
        <>
          <span className="block leading-snug">{row.original.description}</span>
          {note && <span className="text-destructive block text-xs">{note}</span>}
        </>
      )
    },
  })
}
