'use client'

import { Description } from '@/components/ui/description'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ViewSettingsFields } from '@/components/kosztorys/editor/dialogs/view-settings-fields'
import { CLIENT_VIEW_GROUPS, COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { CLIENT_EMPTY_CONDITION_ID } from '@/lib/kosztorys/row-conditions/queries'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'

type PropsT = {
  // `null` while the caller's read is in flight — the placeholder is rendered here so both dialogs
  // don't each carry the same branch.
  value: ClientViewSettingsT | null
  onChange: (value: ClientViewSettingsT) => void
  disabled?: boolean
}

/**
 * The settings body on its own — it owns no persistence and no buttons; the dialog supplies both.
 */
export function ClientViewSettingsForm({ value, onChange, disabled }: PropsT) {
  const { conditionCounts } = useKosztorysEditorContext()
  const emptyCount = conditionCounts.get(CLIENT_EMPTY_CONDITION_ID) ?? 0
  if (!value) return <p className="text-muted-foreground text-sm">Wczytywanie…</p>

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <Description size="xs">
        Kolumny rozliczenia — pomiar z natury, etapy i ich wartości, razem netto i brutto, %
        wykonania — inwestor zobaczy dopiero, gdy będą w nich wpisy. Puste etapy są ukryte.
      </Description>
      <ViewSettingsFields
        groups={CLIENT_VIEW_GROUPS}
        labelFor={(key) => COLUMN_LABELS[key]}
        value={value}
        onChange={onChange}
        emptyCount={emptyCount}
        disabled={disabled}
      />
    </div>
  )
}
