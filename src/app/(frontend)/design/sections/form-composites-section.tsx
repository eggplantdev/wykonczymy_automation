'use client'

import { Description } from '@/components/ui/description'
import { useState } from 'react'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { RegisterBalanceSummary } from '@/components/forms/form-components/register-balance-summary'
import { AiTranslateCheckbox } from '@/components/forms/form-components/ai-translate-checkbox'
import {
  AmountField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  PaymentMethodField,
  SourceRegisterField,
} from '@/components/forms/form-fields'
import { EmptyFieldMessage } from '@/components/forms/form-fields/empty-field-message'
import {
  EquipmentItemFields,
  EquipmentNoteField,
  EquipmentPriceField,
  EquipmentStatusField,
} from '@/components/forms/equipment-form/equipment-item-fields'
import { CollapsibleLineItem } from '@/components/forms/expense-form/collapsible-line-item'
import { ParagonFooter } from '@/components/forms/expense-form/paragon-footer'
import { ReceiptSelectionActions } from '@/components/forms/expense-form/receipt-selection-actions'
import {
  makeLineItem,
  type ReceiptGroupingT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldGroup } from '@/components/ui/field'
import { SelectItem } from '@/components/ui/select'
import type { DecisionStatusT } from '@/components/ui/decision-progress-badge'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type DemoFormValuesT = {
  title: string
  category: string
  contractor: string
  unit: string
  deadline: string
  settled: boolean
  description: string
  amount: string
  date: string
  paymentMethod: string
  investment: string
  worker: string
  holder: string
  sourceRegister: string
  name: string
  serialNumber: string
  make: string
  model: string
  purchaseDate: string
  warrantyUntil: string
  purchasePrice: string
  note: string
  status: string
}

const DEFAULT_VALUES: DemoFormValuesT = {
  title: '',
  category: '',
  contractor: '',
  unit: 'm²',
  deadline: '',
  settled: false,
  description: '',
  amount: '',
  date: '2026-10-20',
  paymentMethod: '',
  investment: '',
  worker: '',
  holder: '',
  sourceRegister: '',
  name: 'Wiertarka udarowa',
  serialNumber: 'SN-000123',
  make: 'Marka',
  model: 'X-200',
  purchaseDate: '2026-03-01',
  warrantyUntil: '2028-03-01',
  purchasePrice: '899',
  note: '',
  status: 'IN_USE',
}

const CATEGORIES = ['Materiały', 'Narzędzia', 'Transport']

const CONTRACTORS = [
  { value: '1', label: 'Firma Przykładowa' },
  { value: '2', label: 'Hurtownia Testowa' },
]

const UNITS = ['m²', 'mb', 'szt.', 'kpl.']

const INVESTMENTS = [
  { id: 1, name: 'Mokotów — łazienka' },
  { id: 2, name: 'Wilanów — kuchnia' },
  { id: 3, name: 'Ursus — zamknięta', active: false },
]

const WORKERS = [
  { id: 11, name: 'Jan Testowy' },
  { id: 12, name: 'Anna Przykładowa' },
]

const CASH_REGISTERS = [
  { id: 21, name: 'Kasa główna' },
  { id: 22, name: 'Kasa firmowa' },
  { id: 23, name: 'Kasa archiwalna', active: false },
]

const LINE_ITEMS = [
  makeLineItem({ id: 'line-1', description: 'Klej do płytek', amount: '120' }),
  makeLineItem({ id: 'line-2', description: 'Fuga', amount: '45.50' }),
  makeLineItem({ id: 'line-3', description: 'Paragon nieczytelny', amount: '' }),
]

const LINE_STATUSES: Record<string, DecisionStatusT> = {
  'line-1': 'pending',
  'line-2': 'accepted',
  'line-3': 'rejected',
}

function noop() {}

export function FormCompositesSection() {
  const form = useAppForm({ defaultValues: DEFAULT_VALUES })
  const [isAiTranslate, setIsAiTranslate] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(['line-1']))
  const [hiddenStatuses, setHiddenStatuses] = useState<ReadonlySet<DecisionStatusT>>(
    () => new Set<DecisionStatusT>(),
  )

  const grouping: ReceiptGroupingT = {
    selectableIds: new Set(LINE_ITEMS.map((item) => item.id)),
    selectedIds,
    mergedIds: new Set(),
    incompleteIds: new Set(['line-3']),
    disabled: false,
    onToggle: (id) => setSelectedIds((previous) => toggleInSet(previous, id)),
    onMerge: noop,
    onSplit: noop,
    onDecide: noop,
    readRowOf: (id) => LINE_ITEMS.findIndex((item) => item.id === id) + 1,
    statusOf: (id) => LINE_STATUSES[id] ?? 'pending',
  }

  return (
    <ShowcaseSection id="form-composites">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">
        A. Pola formularza (form.AppField → field.*)
      </h3>
      <ShowcaseRow
        title="Input / Select / Combobox / CreatableCombobox"
        source="forms/form-components/form-*.tsx"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <form.AppField name="title">
          {(field) => <field.Input label="Nazwa" placeholder="Wpisz nazwę" />}
        </form.AppField>
        <form.AppField name="category">
          {(field) => (
            <field.Select label="Kategoria" placeholder="Wybierz kategorię">
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
        <form.AppField name="contractor">
          {(field) => (
            <field.Combobox
              label="Kontrahent"
              placeholder="Wybierz kontrahenta"
              items={CONTRACTORS}
              searchPlaceholder="Szukaj…"
              emptyMessage="Brak wyników"
            />
          )}
        </form.AppField>
        <form.AppField name="unit">
          {(field) => <field.CreatableCombobox label="Jednostka" options={UNITS} />}
        </form.AppField>
      </ShowcaseRow>
      <ShowcaseRow
        title="DatePicker / Checkbox / Textarea"
        source="forms/form-components/form-*.tsx"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <form.AppField name="deadline">
          {(field) => <field.DatePicker label="Termin" description="Opis pod polem" />}
        </form.AppField>
        <form.AppField name="settled">
          {(field) => <field.Checkbox label="Rozliczone" />}
        </form.AppField>
        <form.AppField name="note">
          {(field) => <field.Textarea label="Notatka" rows={3} placeholder="Dowolny tekst" />}
        </form.AppField>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Wspólne pola transakcji (forms/form-fields)
      </h3>
      <ShowcaseRow
        title="Amount / Date / Description / PaymentMethod"
        source="forms/form-fields/*-field.tsx"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <AmountField form={form} />
        <DateField form={form} />
        <DescriptionField form={form} />
        <PaymentMethodField form={form} />
      </ShowcaseRow>
      <ShowcaseRow
        title="EntityComboboxField (inwestycja, pracownik, pusta lista)"
        source="forms/form-fields/entity-combobox-field.tsx, empty-field-message.tsx"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <EntityComboboxField form={form} variant="investment" items={INVESTMENTS} />
        <EntityComboboxField form={form} variant="worker" items={WORKERS} />
        <EntityComboboxField form={form} variant="holder" items={[]} />
        <form.AppField name="holder">
          {() => <EmptyFieldMessage label="Kasa" message="Brak aktywnych kas" />}
        </form.AppField>
      </ShowcaseRow>
      <ShowcaseRow
        title="SourceRegisterField (+ CashRegisterField, ActiveFilterLabel)"
        source="forms/form-fields/source-register-field.tsx, cash-register-field.tsx"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className="flex flex-col gap-2">
          <SourceRegisterField
            form={form}
            cashRegisters={CASH_REGISTERS}
            registerBalance={12500}
            isRegisterBalanceLoading={false}
            fetchRegisterBalance={noop}
          />
        </div>
        <div className="flex flex-col gap-2">
          <SourceRegisterField
            form={form}
            cashRegisters={CASH_REGISTERS}
            label="Kasa (ładowanie salda)"
            registerBalance={null}
            isRegisterBalanceLoading
            fetchRegisterBalance={noop}
          />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="RegisterBalanceSummary"
        source="forms/form-components/register-balance-summary.tsx"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <RegisterBalanceSummary registerBalance={12500} total={3200} />
        <RegisterBalanceSummary registerBalance={1000} total={2450.5} totalLabel="Suma wypłat" />
      </ShowcaseRow>
      <ShowcaseRow
        title="AiTranslateCheckbox"
        source="forms/form-components/ai-translate-checkbox.tsx"
      >
        <AiTranslateCheckbox checked={isAiTranslate} onCheckedChange={setIsAiTranslate} />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">C. Sprzęt</h3>
      <ShowcaseRow
        title="EquipmentItemFields / Price / Status / Note"
        source="forms/equipment-form/equipment-item-fields.tsx"
        className="grid grid-cols-1 gap-4"
      >
        <FieldGroup>
          <EquipmentItemFields form={form} />
          <EquipmentPriceField form={form} />
          <EquipmentStatusField form={form} />
          <EquipmentNoteField form={form} />
        </FieldGroup>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">D. Paragony</h3>
      <ShowcaseRow
        title="CollapsibleLineItem — wszystkie statusy"
        source="forms/expense-form/collapsible-line-item.tsx"
        className="grid grid-cols-1 gap-2"
      >
        {LINE_ITEMS.map((item, index) => (
          <CollapsibleLineItem
            key={item.id}
            title={`${index + 1}. ${item.description}`}
            status={LINE_STATUSES[item.id] ?? 'pending'}
            defaultOpen={index === 0}
            leading={
              <Checkbox
                checked={selectedIds.has(item.id)}
                onCheckedChange={() => grouping.onToggle(item.id)}
                aria-label={`Zaznacz: ${item.description}`}
              />
            }
          >
            <Description withIcon={false}>Pola pozycji paragonu</Description>
          </CollapsibleLineItem>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="ReceiptSelectionActions"
        source="forms/expense-form/receipt-selection-actions.tsx"
      >
        <ReceiptSelectionActions grouping={grouping} />
        <ReceiptSelectionActions grouping={{ ...grouping, disabled: true }} />
      </ShowcaseRow>
      <ShowcaseRow
        title="ParagonFooter (sticky, ujemne marginesy — w ramce z paddingiem)"
        source="forms/expense-form/paragon-footer.tsx"
        className="grid grid-cols-1"
      >
        <div className="relative rounded-md border p-4 sm:p-6">
          <ParagonFooter
            progress={{ accepted: 1, rejected: 1, pending: 1 }}
            hiddenStatuses={hiddenStatuses}
            onHiddenStatusesChange={setHiddenStatuses}
            grouping={grouping}
            lineItems={LINE_ITEMS}
          />
        </div>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">E. Szkielet formularza</h3>
      <ShowcaseRow
        title="FormShell (+ przycisk czyszczenia) + FormFooter"
        source="forms/form-components/form-shell.tsx, form-footer.tsx"
        className="grid grid-cols-1"
      >
        <div className="relative rounded-md border p-4 pr-24">
          <FormShell form={form} onReset={() => form.reset()}>
            <FieldGroup>
              <DescriptionField form={form} placeholder="Opis" />
              <AmountField form={form} />
            </FieldGroup>
            <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
          </FormShell>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
