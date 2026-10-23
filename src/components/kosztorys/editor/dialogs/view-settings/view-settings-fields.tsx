'use client'

import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Description } from '@/components/ui/description'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { type ColumnGroupT } from '@/lib/kosztorys/columns/column-config'
import { DOCUMENT_PINNED_COLUMN } from '@/lib/kosztorys/columns/document-column-order'

export const GROUP_LEGEND_CLASS = 'mb-0.5 px-2 data-[variant=label]:text-xs'

export type ViewSettingsValueT = { hiddenColumns: string[]; hideEmptyRows: boolean }

// Generic so a caller's wider settings (its column order) survive every edit made here.
type PropsT<T extends ViewSettingsValueT> = {
  groups: readonly ColumnGroupT[]
  labelFor: (key: string) => string | undefined
  value: T
  onChange: (value: T) => void
  emptyCount?: number
  disabled?: boolean
}

export function ViewSettingsFields<T extends ViewSettingsValueT>({
  groups,
  labelFor,
  value,
  onChange,
  emptyCount,
  disabled,
}: PropsT<T>) {
  const hidden = new Set(value.hiddenColumns)

  const toggleColumn = (key: string, visible: boolean) => {
    const next = new Set(hidden)
    if (visible) next.delete(key)
    else next.add(key)
    onChange({ ...value, hiddenColumns: [...next] })
  }

  return (
    <>
      {groups.map((group) => (
        <FieldSet key={group.label} className="gap-0.5">
          <FieldLegend variant="label" tone="muted" className={GROUP_LEGEND_CLASS}>
            {group.label}
          </FieldLegend>
          {group.keys.map((key) => (
            <CheckboxRow
              key={key}
              checked={key === DOCUMENT_PINNED_COLUMN || !hidden.has(key)}
              disabled={disabled || key === DOCUMENT_PINNED_COLUMN}
              onCheckedChange={(visible) => toggleColumn(key, visible)}
            >
              {labelFor(key) ?? key}
            </CheckboxRow>
          ))}
        </FieldSet>
      ))}
      <FieldSet className="gap-0.5 border-t pt-3">
        <FieldLegend variant="label" tone="muted" className={GROUP_LEGEND_CLASS}>
          Pozycje
        </FieldLegend>
        <CheckboxRow
          checked={value.hideEmptyRows}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, hideEmptyRows: checked })}
        >
          Ukryj pozycje bez przedmiaru i bez wykonanej pracy
          {emptyCount === undefined ? '' : ` (${emptyCount})`}
        </CheckboxRow>
        <Description size="xs">
          Takie pozycje nie wnoszą nic do żadnej kwoty, więc ukrycie ich nie zmienia podsumowania.
        </Description>
      </FieldSet>
    </>
  )
}
