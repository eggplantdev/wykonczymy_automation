'use client'

import { type ReactNode } from 'react'
import { SortHeader } from '@/components/kosztorys/editor/grid/sort-header'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { columnLabelForView } from '@/lib/kosztorys/column-config'
import { headerTipFor } from '@/lib/kosztorys/header-tips'
import { activeSortPick } from '@/lib/kosztorys/row-view'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

function withTip(node: ReactNode, tip: string): ReactNode {
  return (
    <SimpleTooltip content={tip}>
      <span className="flex size-full items-center">{node}</span>
    </SimpleTooltip>
  )
}

// A column header that offers the sort menu, or — with no `onSetSort`, i.e. a preview — the bare
// label. The tip goes ONTO the sort trigger (same element), not around it: a second wrapping trigger
// would fight the dropdown for the click. Plain labels have no trigger, so they wrap directly, and
// they wrap (no truncate) into the fixed, taller header row (KosztorysEditorBody).
function sortableHeader(
  label: string,
  field: string,
  tip: string | undefined,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'onPersistKosztorysOrder'>,
): ReactNode {
  const { onSetSort } = opts
  if (onSetSort) {
    return (
      <SortHeader
        label={label}
        active={activeSortPick(opts.sort, field)}
        tip={tip}
        onSort={(pick) => onSetSort(field, pick)}
        onPersistOrder={opts.onPersistKosztorysOrder}
      />
    )
  }
  const node = <HeaderLabel>{label}</HeaderLabel>
  return tip ? withTip(node, tip) : node
}

// The label is resolved from `field`, never passed in: every header and the column picker then read
// the same resolver, so a label that becomes view-dependent can't land in one and miss the other.
export function columnTitle(
  field: string,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'onPersistKosztorysOrder' | 'view'>,
): ReactNode {
  return sortableHeader(
    columnLabelForView(field, opts.view),
    field,
    // Base key: a plane's „Cena j.m. netto" and „Źródło ceny wykonawcy" explain the same figure on
    // both planes, so the tip is written once and every plane reads it.
    headerTipFor(field),
    opts,
  )
}

// Header of a per-stage value column: a read-only mirror of the stage's name. One source for the
// name, so a rename moves all three of the stage's headers and a delete takes all three columns.
// Deliberately not `StageHeader` — a mirror carries no rename/delete affordance of its own; its
// label is simply one the column-label resolver cannot produce, the stage's name being data rather
// than a static column label.
export function stageValueHeader(
  stage: KosztorysStageT,
  suffix: string,
  tip: string | undefined,
  field: string,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'onPersistKosztorysOrder'>,
): ReactNode {
  return sortableHeader(`${stageLabel(stage)} ${suffix}`, field, tip, opts)
}
