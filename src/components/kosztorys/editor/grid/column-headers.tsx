'use client'

import { type ReactNode } from 'react'
import { SortHeader } from '@/components/kosztorys/editor/grid/sort-header'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { TranslatorT } from '@/lib/i18n/translations'
import { columnLabelForView } from '@/lib/kosztorys/columns/column-config'
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

// The tip goes ONTO the sort trigger (same element), not around it: a second wrapping trigger
// would fight the dropdown for the click.
function sortableHeader(
  label: string,
  field: string,
  tip: string | undefined,
  opts: Pick<
    BuildV2ColumnsOptsT,
    'sort' | 'onSetSort' | 'onPersistKosztorysOrder' | 'columnColors' | 'onSetColumnColor'
  >,
): ReactNode {
  const { onSetSort, onSetColumnColor } = opts
  if (onSetSort) {
    return (
      <SortHeader
        label={label}
        active={activeSortPick(opts.sort, field)}
        tip={tip}
        onSort={(pick) => onSetSort(field, pick)}
        onPersistOrder={opts.onPersistKosztorysOrder}
        color={opts.columnColors?.[field] ?? null}
        onSetColor={onSetColumnColor && ((color) => onSetColumnColor(field, color))}
      />
    )
  }
  const node = <HeaderLabel>{label}</HeaderLabel>
  return tip ? withTip(node, tip) : node
}

function surfaceDictionary(
  opts: Pick<BuildV2ColumnsOptsT, 'workerSurface' | 'dictionary'>,
): TranslatorT<'grid'> | undefined {
  return opts.workerSurface ? opts.dictionary : undefined
}

export function columnTitle(
  field: string,
  opts: Pick<
    BuildV2ColumnsOptsT,
    | 'sort'
    | 'onSetSort'
    | 'onPersistKosztorysOrder'
    | 'view'
    | 'workerSurface'
    | 'dictionary'
    | 'columnColors'
    | 'onSetColumnColor'
  >,
): ReactNode {
  const dictionary = surfaceDictionary(opts)
  return sortableHeader(
    columnLabelForView(field, opts.view, dictionary),
    field,
    headerTipFor(field, { workerSurface: !!opts.workerSurface, dictionary }),
    opts,
  )
}

export function stageValueHeader(
  stage: KosztorysStageT,
  axis: 'net' | 'gross',
  group: string,
  field: string,
  opts: Pick<
    BuildV2ColumnsOptsT,
    | 'sort'
    | 'onSetSort'
    | 'onPersistKosztorysOrder'
    | 'workerSurface'
    | 'dictionary'
    | 'columnColors'
    | 'onSetColumnColor'
  >,
): ReactNode {
  const dictionary = surfaceDictionary(opts)
  // Brutto never reaches the worker's link, so only netto has a translation.
  const label =
    dictionary && axis === 'net'
      ? dictionary.t('stageValueNetHeader', { stage: stageLabel(stage, dictionary) })
      : `${stageLabel(stage)} ${axis === 'net' ? 'netto' : 'brutto'}`
  return sortableHeader(
    label,
    field,
    headerTipFor(group, { workerSurface: !!opts.workerSurface, dictionary }),
    opts,
  )
}
