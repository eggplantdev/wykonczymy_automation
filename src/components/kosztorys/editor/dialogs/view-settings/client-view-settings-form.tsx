'use client'

import { Description } from '@/components/ui/description'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ViewSettingsFields } from '@/components/kosztorys/editor/dialogs/view-settings/view-settings-fields'
import { DocumentColumnOrderButton } from '@/components/kosztorys/editor/dialogs/view-settings/document-column-order-button'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { CLIENT_DOCUMENT_COLUMNS, CLIENT_VIEW_GROUPS } from '@/lib/kosztorys/client-view/columns'
import { CLIENT_EMPTY_CONDITION_ID } from '@/lib/kosztorys/row-conditions/queries'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { ColumnRanksT } from '@/lib/table/column-order'

type PropsT = {
  // `null` while the caller's read is in flight — the placeholder is rendered here so both dialogs
  // don't each carry the same branch.
  value: ClientViewSettingsT | null
  onChange: (value: ClientViewSettingsT) => void
  defaultColumnRanks: ColumnRanksT
  disabled?: boolean
}

export function ClientViewSettingsForm({ value, onChange, defaultColumnRanks, disabled }: PropsT) {
  const { conditionCounts } = useKosztorysEditorContext()
  const emptyCount = conditionCounts.get(CLIENT_EMPTY_CONDITION_ID) ?? 0
  if (!value) return <p className="text-muted-foreground text-sm">Wczytywanie…</p>

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <Description size="xs">
        Kolumny rozliczenia — pomiar z natury, etapy i ich wartości, razem netto, rabat kwota i %
        wykonania — pojawią się u inwestora dopiero po pierwszym wpisie w którymkolwiek etapie. Etap
        bez wpisów pozostaje ukryty.
      </Description>
      <DocumentColumnOrderButton
        keys={CLIENT_DOCUMENT_COLUMNS}
        labelFor={(key) => COLUMN_LABELS[key]}
        value={value}
        onChange={onChange}
        resetRanks={defaultColumnRanks}
        disabled={disabled}
      />
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
