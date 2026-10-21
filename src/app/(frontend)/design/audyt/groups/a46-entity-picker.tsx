'use client'

import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Field, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { SELECT_NONE, SimpleSelect } from '@/components/ui/simple-select'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const WORKERS = [
  { value: '1', label: 'Jan Kowalski' },
  { value: '2', label: 'Piotr Wiśniewski' },
]

const INVESTMENTS = [
  { value: '10', label: 'Mieszkanie Mokotów' },
  { value: '11', label: 'Dom Wilanów' },
]

export function A46EntityPickerGroup() {
  return (
    <AuditGroup
      id="A46"
      title="Wybór inwestycji/pracownika poza formularzem"
      count="9 wystąpień w 8 plikach · 8 wersji"
      drift={[
        'Kontrolka: SearchSelect (z wyszukiwarką) vs SimpleSelect (bez) dla tej samej listy inwestycji/pracowników; formularze używają EntityComboboxField.',
        'Etykieta: Field gap="md" + FieldLabel vs div grid gap-2 + Label vs brak etykiety (kosztorys do inwestycji, podział etapu, import arkusza, kierownik budowy).',
        'Placeholder: „Wybierz inwestycję” vs „Wybierz inwestycję…” vs „Dodaj pracownika...”; pozycja „— brak —” tylko w dwóch miejscach.',
        'searchPlaceholder/emptyMessage ustawione tylko w trzech SearchSelectach; reszta pokazuje domyślne „Szukaj”.',
        'Rozmiar: domyślny vs className="w-full" vs size="xs" + w-auto min-w-56 text-xs vs variant="toolbarSm".',
      ]}
      proposal={
        <>
          <code>EntityPicker</code> w <code>ui/</code> na bazie SearchSelect (props:{' '}
          <code>entity</code> = &quot;investment&quot; | &quot;worker&quot;, <code>label?</code>,{' '}
          <code>allowNone?</code>, <code>size?</code>) — placeholder, searchPlaceholder i
          emptyMessage wynikają z <code>entity</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="Field gap=md + FieldLabel + SearchSelect, tylko placeholder (bez searchPlaceholder/emptyMessage)"
        sources={[
          'src/components/worker-reports/scan-report-dialog.tsx:164',
          'src/components/worker-reports/scan-report-dialog.tsx:176',
        ]}
      >
        <Field gap="md">
          <FieldLabel htmlFor="audit-a46-scan-worker">Pracownik</FieldLabel>
          <SearchSelect
            id="audit-a46-scan-worker"
            value=""
            onChange={() => {}}
            items={WORKERS}
            placeholder="Wybierz pracownika"
          />
        </Field>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="Field gap=md + FieldLabel + SimpleSelect className=w-full"
        sources={['src/components/worker-expenses/expense-draft-dialog.tsx:145']}
      >
        <Field gap="md">
          <FieldLabel htmlFor="audit-a46-expense-investment">Inwestycja</FieldLabel>
          <SimpleSelect
            id="audit-a46-expense-investment"
            value=""
            onValueChange={() => {}}
            placeholder="Wybierz inwestycję"
            className="w-full"
            options={[...INVESTMENTS, { value: 'no-investment', label: 'Bez inwestycji' }]}
          />
        </Field>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="Field gap=md + FieldLabel z przełącznikiem „Aktywne” (ActiveFilterLabel = CheckboxRow plain) + SearchSelect z searchPlaceholder i emptyMessage"
        sources={['src/components/leads/lead-assets-dialog.tsx:150']}
      >
        <Field gap="md">
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="audit-a46-lead-target">Inwestycja docelowa</FieldLabel>
            <CheckboxRow
              variant="plain"
              checked
              onCheckedChange={() => {}}
              className="w-fit font-normal"
            >
              Aktywne
            </CheckboxRow>
          </div>
          <SearchSelect
            id="audit-a46-lead-target"
            value=""
            onChange={() => {}}
            placeholder="Wybierz inwestycję"
            searchPlaceholder="Szukaj inwestycji..."
            emptyMessage="Nie znaleziono inwestycji."
            items={INVESTMENTS}
          />
        </Field>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="div space-y-2 text-sm + SimpleSelect bez etykiety i id, placeholder z „…”"
        sources={['src/components/dialogs/link-sheet-to-investment-dialog.tsx:65']}
      >
        <div className="space-y-2 text-sm">
          <SimpleSelect
            value=""
            onValueChange={() => {}}
            placeholder="Wybierz inwestycję…"
            options={INVESTMENTS}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="div grid gap-2 + Label + SimpleSelect z pozycją „— brak —” (kontakt na miejscu)"
        sources={['src/components/orders/order-pick-step.tsx:165']}
      >
        <div className="grid gap-2">
          <Label htmlFor="audit-a46-order-contact">Kontakt na miejscu</Label>
          <SimpleSelect
            id="audit-a46-order-contact"
            value="1"
            onValueChange={() => {}}
            options={[
              { value: SELECT_NONE, label: '— brak —' },
              { value: '1', label: 'Jan Kowalski · 600 100 200' },
              { value: '2', label: 'Piotr Wiśniewski · 600 300 400' },
            ]}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="sam SearchSelect bez etykiety, placeholder „Dodaj pracownika...”, searchPlaceholder/emptyMessage ze STAGE_HEADER_COPY"
        sources={['src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:200']}
      >
        <SearchSelect
          value=""
          items={WORKERS}
          placeholder="Dodaj pracownika..."
          searchPlaceholder="Szukaj pracownika..."
          emptyMessage="Nie znaleziono pracownika."
          onChange={() => {}}
        />
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="SearchSelect size=xs, w-auto min-w-56 text-xs, obok SimpleSelect toolbarSm (rozliczenie), bez etykiety"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx:215']}
      >
        <div className="flex flex-wrap gap-2">
          <SimpleSelect
            value="none"
            onValueChange={() => {}}
            options={[{ value: 'none', label: 'Nie ustawiaj — wybiorę w kosztorysie' }]}
            variant="toolbarSm"
          />
          <SearchSelect
            value=""
            onChange={() => {}}
            items={WORKERS}
            searchPlaceholder="Szukaj pracownika..."
            emptyMessage="Nie znaleziono pracownika."
            size="xs"
            className="w-auto min-w-56 text-xs"
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="SimpleSelect variant=toolbarSm z „— brak —”, w wierszu InfoList (kierownik budowy, zapis od razu)"
        sources={['src/components/investments/investment-site-manager-select.tsx:41']}
      >
        <SimpleSelect
          value="1"
          onValueChange={() => {}}
          options={[{ value: SELECT_NONE, label: '— brak —' }, ...WORKERS]}
          variant="toolbarSm"
        />
      </AuditVariant>
    </AuditGroup>
  )
}
