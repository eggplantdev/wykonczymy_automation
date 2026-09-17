'use client'

import { UnfoldVertical } from 'lucide-react'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useRowHeightFit } from '@/components/kosztorys/editor/actions/row-height-fit-context'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * Own component so the fit context is read only while a menu is open: the measurement closes over the
 * column widths, so reading it in the cell would re-render every row's „…" on each resize.
 */
export function RowHeightMenuItems({ row }: { row: KosztorysV2RowT }) {
  const fit = useRowHeightFit()
  if (!fit) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => fit(row)}>
        <UnfoldVertical />
        Dopasuj wysokość do treści
      </DropdownMenuItem>
    </>
  )
}
