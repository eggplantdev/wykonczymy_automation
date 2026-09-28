'use client'

import { Description } from '@/components/ui/description'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ViewSettingsFields } from '@/components/kosztorys/editor/dialogs/view-settings-fields'
import { CLIENT_VIEW_GROUPS, COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { CLIENT_EMPTY_CONDITION_ID } from '@/lib/kosztorys/row-conditions/queries'
import type {
  ClientViewConfigT,
  ClientViewModeT,
  ClientViewSettingsT,
} from '@/lib/kosztorys/client-view-settings'

type PropsT = {
  // `null` while the caller's read is in flight — the placeholder is rendered here so both dialogs
  // don't each carry the same branch.
  value: ClientViewConfigT | null
  onChange: (value: ClientViewConfigT) => void
  disabled?: boolean
}

const MODE_OPTIONS: { value: ClientViewModeT; label: string }[] = [
  { value: 'OFFER', label: 'Oferta' },
  { value: 'SETTLEMENT', label: 'Rozliczenie' },
]

/**
 * The settings body on its own, so „Ustawienia podglądu…" and „Udostępnij" render the same one
 * rather than growing a second copy that could drift. It owns no persistence and no buttons — the
 * caller supplies both, which is what makes it reusable as a step.
 *
 * The variant toggle edits the draft's `mode` and nothing else — which variant you are ticking is
 * the same decision as which one the client gets, and it lands only when the caller saves.
 */
export function ClientViewSettingsForm({ value, onChange, disabled }: PropsT) {
  const { conditionCounts } = useKosztorysEditorContext()
  const emptyCount = conditionCounts.get(CLIENT_EMPTY_CONDITION_ID) ?? 0
  if (!value) return <p className="text-muted-foreground text-sm">Wczytywanie…</p>
  const variant = value.variants[value.mode]

  const changeVariant = (next: ClientViewSettingsT) =>
    onChange({ ...value, variants: { ...value.variants, [value.mode]: next } })

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-1.5">
        <ToggleGroup
          options={MODE_OPTIONS}
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          disabled={disabled}
          aria-label="Wariant podglądu inwestora"
          className="self-start"
        />
        <Description size="xs">
          Inwestor widzi wariant wybrany tutaj. Drugi zestaw kolumn zostaje zapamiętany.
        </Description>
      </div>
      <ViewSettingsFields
        groups={CLIENT_VIEW_GROUPS}
        labelFor={(key) => COLUMN_LABELS[key]}
        value={variant}
        onChange={changeVariant}
        emptyCount={emptyCount}
        disabled={disabled}
      />
    </div>
  )
}
