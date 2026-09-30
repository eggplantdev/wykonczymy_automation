import { createColumnHelper } from '@tanstack/react-table'
import { SectionPill } from '@/components/kosztorys/worker-report/section-pill'

type SectionedRowT = { description: string; sectionName: string; sectionOrder: number }

export function sectionColumn<RowT extends SectionedRowT>() {
  // Sorted by the rozpiska's own section order, not alphabetically — that is the order both people know.
  return createColumnHelper<RowT>().accessor((row) => row.sectionOrder, {
    id: 'section',
    header: 'Sekcja',
    cell: ({ row }) => <SectionPill name={row.original.sectionName} />,
  })
}
