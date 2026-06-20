'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildKosztorysExportColumns } from '@/lib/export/kosztorys-export-columns'
import { buildKosztorysCsvFlat, buildKosztorysCsvGrouped } from '@/lib/export/kosztorys-csv'
import { triggerDownload } from '@/lib/export/download'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysStageT, KosztorysV2RowT, SectionSubtotalT } from '@/types/kosztorys'

type PropsT = {
  rows: KosztorysV2RowT[]
  stages: KosztorysStageT[]
  hidden: Set<string>
  view: PriceViewT
  subtotals: SectionSubtotalT[]
  investmentName: string
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kosztorys'

export function KosztorysCsvButton({
  rows,
  stages,
  hidden,
  view,
  subtotals,
  investmentName,
}: PropsT) {
  function download(variant: 'plaski' | 'grupowany') {
    const columns = buildKosztorysExportColumns(stages).filter((c) => !hidden.has(c.id))
    const csv =
      variant === 'plaski'
        ? buildKosztorysCsvFlat(rows, columns, view)
        : buildKosztorysCsvGrouped(rows, columns, view, subtotals)
    // BOM, żeby Google Sheets/Excel wzięły UTF-8 (polskie znaki).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(blob, `kosztorys-${slug(investmentName)}-${date}-${variant}.csv`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => download('plaski')}>CSV płaski</DropdownMenuItem>
        <DropdownMenuItem onClick={() => download('grupowany')}>CSV grupowany</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
