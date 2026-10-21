'use client'

import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DecimalField } from '@/components/ui/decimal-field'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const SECTION_OPTIONS = [
  { value: 'lazienka', label: 'Łazienka' },
  { value: 'kuchnia', label: 'Kuchnia' },
]

const PLANE_OPTIONS = [
  { value: 'labor', label: 'Robocizna' },
  { value: 'materials', label: 'Materiały' },
]

const SUPPLIER_OPTIONS = [
  { value: 's1', label: 'Kontenery Kraków · 601 234 567' },
  { value: 's2', label: 'Wywóz Gruzu Nowak · 602 345 678' },
]

const CONTACT_OPTIONS = [
  { value: 'none', label: '— brak —' },
  { value: 'w1', label: 'Jan Kowalski · 603 456 789' },
]

export function A30InlineFieldsGroup() {
  return (
    <AuditGroup
      id="A30"
      title="Pola wbudowane"
      count="9 wystąpień w 6 plikach · 6 wersji + 3 wzorce"
      drift={[
        'select z etykietą: każda kopia nadpisuje Label tym samym gap-2 text-sm font-normal; szerokość w-56 ×2 vs w-44; placeholder/invalid tylko w części kopii',
        'kwota + „Zapisz”: przycisk size="xs" vs size="sm" className="h-7 px-2" w DecimalField — dwa różne „Zapisz” w tym samym popoverze ustawień; text-chart-green rounded-md wpisane ręcznie; „zł” luzem w Label zamiast propa suffix',
        'wyszukiwarka raportu: ikona left-3 size-4 i pole h-10 pl-9 vs left-2.5 i h-8 pl-8 w SearchFilterInput',
        'etykieta nad polem: w tym samym formularzu dwa pola mają Field gap="md" + FieldLabel, a dwa kolejne ręczny div.grid.gap-2 + Label',
      ]}
      proposal={
        <>
          <code>InlineSelectField</code> (props: <code>label</code> + propsy{' '}
          <code>SimpleSelect</code>) dla selecta z etykietą obok; kwoty na{' '}
          <code>DecimalField withSave</code> (z trybem dwóch pól pod jednym „Zapisz”); wyszukiwarka
          na <code>SearchFilterInput</code> z propem <code>size</code>; etykiety nad polem na{' '}
          <code>Field gap=&quot;md&quot;</code> + <code>FieldLabel</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="kwota + „Zapisz”: para netto/brutto, dwa Label xs muted z DecimalInput + „zł” luzem, jeden Button outline xs"
        sources={[
          'src/components/kosztorys/summary/settings/discount-amount-pair-field.tsx:65',
          'src/components/kosztorys/summary/settings/discount-amount-pair-field.tsx:77',
        ]}
      >
        <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
          <Label size="xs" tone="muted">
            netto
            <DecimalInput
              defaultValue="1 000,00"
              placeholder="zł"
              className="text-chart-green rounded-md"
            />
            zł
          </Label>
          <Label size="xs" tone="muted">
            brutto
            <DecimalInput
              defaultValue="1 230,00"
              placeholder="zł"
              className="text-chart-green rounded-md"
            />
            zł
          </Label>
          <Button type="button" variant="outline" size="xs">
            Zapisz
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="etykieta nad polem: ręczny div.grid.gap-2 + Label (zamiast Field gap=md + FieldLabel z tego samego formularza)"
        sources={[
          'src/components/orders/order-pick-step.tsx:131',
          'src/components/orders/order-pick-step.tsx:158',
        ]}
      >
        <div className="flex w-full flex-col gap-3">
          <div className="grid gap-2">
            <Label htmlFor="audit-a30-supplier">Dostawca</Label>
            <SimpleSelect
              id="audit-a30-supplier"
              value="s1"
              onValueChange={noop}
              options={SUPPLIER_OPTIONS}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="audit-a30-contact">Kontakt na miejscu</Label>
            <SimpleSelect
              id="audit-a30-contact"
              value="w1"
              onValueChange={noop}
              options={CONTACT_OPTIONS}
            />
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="select z etykietą: Label gap-2 text-sm font-normal + SimpleSelect w-56 z placeholder i invalid (pokazany pusty i błędny)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog.tsx:78',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:329',
        ]}
      >
        <Label className="gap-2 text-sm font-normal">
          Do sekcji
          <SimpleSelect
            value=""
            onValueChange={noop}
            options={SECTION_OPTIONS}
            placeholder="Wybierz sekcję"
            invalid
            className="w-56"
          />
        </Label>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="select z etykietą: jak c, ale w-44, placeholder bez invalid (pokazany pusty)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:339',
        ]}
      >
        <Label className="gap-2 text-sm font-normal">
          Rozliczenie
          <SimpleSelect
            value=""
            onValueChange={noop}
            options={PLANE_OPTIONS}
            placeholder="Wybierz"
            className="w-44"
          />
        </Label>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="kwota + „Zapisz”: jedno pole, Label xs muted z DecimalInput + suffix + Button outline xs (+ ConfirmDialog)"
        sources={['src/components/kosztorys/summary/settings/discount-value-field.tsx:52']}
      >
        <Label size="xs" tone="muted">
          <DecimalInput defaultValue="5" placeholder="%" className="text-chart-green rounded-md" />%
          <Button type="button" variant="outline" size="xs">
            Zapisz
          </Button>
        </Label>
      </AuditVariant>
      <AuditVariant
        letter="f"
        label="wyszukiwarka: ręczna ikona Search left-3 size-4 + Input h-10 pl-9"
        sources={['src/components/kosztorys/worker-report/report-bar.tsx:23']}
      >
        <div className="relative w-full max-w-md">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input placeholder="Szukaj pracy…" className="h-10 pl-9" />
        </div>
      </AuditVariant>
      <AuditVariant
        letter="g"
        label="wzorzec — DecimalField withSave (Zapisz: size sm h-7 px-2)"
        sources={[
          'src/components/kosztorys/summary/settings/vat-rate-field.tsx:18',
          'src/components/kosztorys/summary/settings/materials-net-pricing-control.tsx:51',
          'src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:79',
        ]}
      >
        <DecimalField
          label="Stawka vat na materiały"
          suffix="%"
          withSave
          value={23}
          min={0}
          max={100}
          onCommit={noop}
        />
      </AuditVariant>
      <AuditVariant
        letter="h"
        label="wzorzec — Field gap=md + FieldLabel (ten sam formularz co b)"
        sources={[
          'src/components/orders/order-pick-step.tsx:112',
          'src/components/orders/order-pick-step.tsx:121',
        ]}
      >
        <Field gap="md">
          <FieldLabel htmlFor="audit-a30-quantity">Ilość</FieldLabel>
          <Input id="audit-a30-quantity" inputMode="numeric" defaultValue="2" />
        </Field>
      </AuditVariant>
      <AuditVariant
        letter="i"
        label="wzorzec — markup SearchFilterInput (filters/, nie ui/): ikona left-2.5 + Input h-8 pl-8"
        sources={['src/components/filters/search-filter-input.tsx:67']}
      >
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
          <Input placeholder="Szukaj..." className="h-8 pl-8" />
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
