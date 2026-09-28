'use client'

import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Description } from '@/components/ui/description'
import { DOCUMENT_PINNED_COLUMN, type ClientViewGroupT } from '@/lib/kosztorys/column-config'

export type ViewSettingsValueT = { hiddenColumns: string[]; hideEmptyRows: boolean }

// Generic so a caller's wider settings (its column order) survive every edit made here.
type PropsT<T extends ViewSettingsValueT> = {
  groups: readonly ClientViewGroupT[]
  labelFor: (key: string) => string | undefined
  value: T
  onChange: (value: T) => void
  // Absent where the count has no single answer — the worker set spans every worker's etapy.
  emptyCount?: number
  disabled?: boolean
}

/**
 * A tick means „to widać"; the stored shape is the inverse (hidden keys), so a column added to the
 * ceiling later shows up on its own.
 */
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
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="text-muted-foreground px-2 text-xs font-medium">{group.label}</p>
          {group.keys.map((key) => (
            <CheckboxRow
              key={key}
              // Shown ticked and locked rather than left out: the owner reads the whole document
              // here, and „Opis prac" is on it.
              checked={key === DOCUMENT_PINNED_COLUMN || !hidden.has(key)}
              disabled={disabled || key === DOCUMENT_PINNED_COLUMN}
              onCheckedChange={(visible) => toggleColumn(key, visible)}
            >
              {labelFor(key) ?? key}
            </CheckboxRow>
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-0.5 border-t pt-3">
        <p className="text-muted-foreground px-2 text-xs font-medium">Pozycje</p>
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
      </div>
    </>
  )
}
