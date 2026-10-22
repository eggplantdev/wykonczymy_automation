'use client'

import { useState } from 'react'
import { Description } from '@/components/ui/description'
import { InlineLoading } from '@/components/ui/loader/inline-loading'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ViewSettingsFields } from '@/components/kosztorys/editor/dialogs/view-settings/view-settings-fields'
import { DocumentColumnOrderButton } from '@/components/kosztorys/editor/dialogs/view-settings/document-column-order-button'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { CLIENT_DOCUMENT_COLUMNS, CLIENT_VIEW_GROUPS } from '@/lib/kosztorys/client-view/columns'
import {
  groupsForMoneyFamily,
  isListedInMoneyFamily,
  type MoneyFamilyT,
} from '@/lib/kosztorys/client-view/money-family'
import { CLIENT_EMPTY_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { ColumnRanksT } from '@/lib/table/column-order'

const MONEY_FAMILY_OPTIONS: { value: MoneyFamilyT; label: string }[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
]

type PropsT = {
  value: ClientViewSettingsT | null
  onChange: (value: ClientViewSettingsT) => void
  defaultColumnRanks: ColumnRanksT
  disabled?: boolean
}

export function ClientViewSettingsForm({ value, onChange, defaultColumnRanks, disabled }: PropsT) {
  const { conditionCounts } = useKosztorysEditorContext()
  const [family, setFamily] = useState<MoneyFamilyT>('net')
  const emptyCount = conditionCounts.get(CLIENT_EMPTY_CONDITION_ID) ?? 0
  if (!value) return <InlineLoading label="Wczytywanie…" />

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <Description size="xs">
        Kolumny rozliczenia — pomiar z natury, etapy i ich wartości, razem etapy, rabat kwota i %
        wykonania — pojawią się u inwestora dopiero po pierwszym wpisie w którymkolwiek etapie. Etap
        bez wpisów pozostaje ukryty.
      </Description>
      <ToggleGroup
        options={MONEY_FAMILY_OPTIONS}
        value={family}
        onChange={setFamily}
        aria-label="Kwoty netto lub brutto"
        className="shrink-0 self-start"
      />
      <DocumentColumnOrderButton
        keys={CLIENT_DOCUMENT_COLUMNS}
        labelFor={(key) => COLUMN_LABELS[key]}
        value={value}
        onChange={onChange}
        resetRanks={defaultColumnRanks}
        isListed={(key) => isListedInMoneyFamily(key, family)}
        disabled={disabled}
      />
      <ViewSettingsFields
        groups={groupsForMoneyFamily(CLIENT_VIEW_GROUPS, family)}
        labelFor={(key) => COLUMN_LABELS[key]}
        value={value}
        onChange={onChange}
        emptyCount={emptyCount}
        disabled={disabled}
      />
    </div>
  )
}
