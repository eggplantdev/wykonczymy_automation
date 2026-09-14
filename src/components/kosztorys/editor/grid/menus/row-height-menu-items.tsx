'use client'

import { UnfoldVertical } from 'lucide-react'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useRowHeightFit } from '@/components/kosztorys/editor/actions/row-height-fit-context'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * Its own component so the fit context is read only while a menu is OPEN — Radix mounts the content
 * on demand, and reading it in the cell instead would re-render every visible row's „…" whenever a
 * column is resized, since the measurement closes over the column widths.
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
