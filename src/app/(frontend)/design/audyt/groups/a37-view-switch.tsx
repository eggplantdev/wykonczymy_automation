'use client'

import { Banknote, Coins, FileArchive, LayoutList, Split, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { InlineModeSelect } from '@/components/ui/inline-mode-select'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { SlicePie } from '@/components/ui/slice-pie'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const SETTLEMENT_OPTIONS: SelectOptionT[] = [
  { value: 'NET', label: 'Netto', icon: Coins },
  { value: 'GROSS', label: 'Brutto', icon: Banknote },
  { value: 'MIXED', label: 'Mieszane', icon: Split },
]

const PRICING_OPTIONS: SelectOptionT[] = [
  { value: 'gross', label: 'Brutto', icon: Banknote },
  { value: 'net', label: 'Netto', icon: Coins },
]

const PRICING_HINT = 'Wydatki inwestycyjne rozliczane po kwotach brutto z faktury (domyślne).'

const PIE_SLICES = [
  { id: 'lazienka', name: 'Łazienka', value: 18400, fill: 'var(--color-section-blue-soft)' },
  { id: 'kuchnia', name: 'Kuchnia', value: 12300, fill: 'var(--color-section-turquoise-soft)' },
  { id: 'salon', name: 'Salon', value: 7650, fill: 'var(--color-section-teal-soft)' },
]

function formatShare(fraction: number | null) {
  return fraction === null ? '—' : `${Math.round(fraction * 100)}%`
}

export function A37ViewSwitchGroup() {
  return (
    <AuditGroup
      id="A37"
      title="Przełącznik widoku / trybu"
      count="18 wystąpień w 19 plikach · 7 wersji"
      drift={[
        'Ta sama rola (przełącz widok listy/tabeli) raz variant="default" z wypełnionym tłem primary, raz variant="muted" z białą pigułką na szarym tle.',
        'Rozmiar: domyślny h-8 text-xs w większości, size="md" isEqualWidth w zamówieniu, size="lg" isEqualWidth w stopce raportu pracownika.',
        'Wybór 2–3 trybów rozliczenia raz jako InlineModeSelect (zakładki podsumowania), raz jako SimpleSelect toolbarSm w SettingsSection (ustawienia inwestycji), choć to te same opcje Netto/Brutto/Mieszane.',
        'Etykiety: tekstowe wszędzie poza przełącznikiem transakcji (same ikony size-4 z tooltipem); aria-label ustawiony tylko w części miejsc.',
      ]}
      proposal={
        <>
          Zostaje jeden <code>ToggleGroup</code>, ale z ustalonym podziałem:{' '}
          <code>variant=&quot;muted&quot;</code> dla przełączania widoku,{' '}
          <code>variant=&quot;default&quot;</code> dla wyboru trybu danych; tryby rozliczenia
          wszędzie przez <code>InlineModeSelect</code> (także w <code>SettingsSection</code>).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="variant default w wierszu z innymi kontrolkami (tu: panel sum — wiersz flex-wrap gap-x-4 pt-4; tabela materiałów z „Pobierz faktury” ml-auto; pozycje wydatku z „Dodaj pozycję” ml-auto; wykres jako action SlicePie)"
        sources={[
          'src/components/kosztorys/summary/summary-panel-content.tsx:178',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:194',
          'src/components/forms/expense-form/line-items-field.tsx:397',
          'src/components/kosztorys/summary/charts/section-share-pie.tsx:26',
          'src/components/fleet/vehicle-detail-tabs.tsx:34',
          'src/components/investments/stats-version-toggle.tsx:28',
          'src/app/(frontend)/inwestycje/[id]/page.tsx:68',
          'src/components/kosztorys/summary/tabs/summary-margin-tab.tsx:41',
          'src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:97',
          'src/components/kosztorys/editor/dialogs/preset/save-preset-dialog.tsx:75',
        ]}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pt-4">
            <ToggleGroup
              options={[
                { value: 'summary', label: 'Podsumowanie' },
                { value: 'expenses', label: 'Materiały' },
                { value: 'stages', label: 'Robocizna' },
              ]}
              value="summary"
              onChange={noop}
              aria-label="Widok podsumowania"
            />
          </div>
          <div className="flex w-full items-center gap-2">
            <ToggleGroup
              options={[
                { value: 'gross', label: 'Materiały brutto (12)' },
                { value: 'net', label: 'Materiały rozliczane netto (3)' },
              ]}
              value="gross"
              onChange={noop}
              aria-label="Zestaw wydatków"
            />
            <Button variant="outline" size="sm" className="ml-auto">
              <FileArchive />
              Pobierz faktury
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              options={[
                { value: 'one-per-photo', label: 'Kilka wydatków' },
                { value: 'one-invoice', label: 'Jeden wydatek' },
              ]}
              value="one-per-photo"
              onChange={noop}
              aria-label="Co oznaczają wybrane zdjęcia"
            />
            <Button type="button" variant="outline" size="sm" className="ml-auto">
              Dodaj pozycję
            </Button>
          </div>
          <SlicePie
            formatShare={formatShare}
            caption="Udział sekcji w kosztach robocizny"
            action={
              <ToggleGroup
                options={[
                  { value: 'planned', label: 'Przedmiar' },
                  { value: 'executed', label: 'Wykonane' },
                ]}
                value="planned"
                onChange={noop}
                aria-label="Podstawa udziału sekcji"
              />
            }
            slices={PIE_SLICES}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="InlineModeSelect zamiast przełącznika (tu: rozliczenie robocizny; materiały w div flex-col items-start gap-2 z lockedReason)"
        sources={[
          'src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:88',
          'src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:67',
        ]}
      >
        <div className="flex w-full flex-col gap-4">
          <InlineModeSelect
            label="Rozliczenie robocizny"
            value="NET"
            onValueChange={noop}
            options={SETTLEMENT_OPTIONS}
          />
          <div className="flex flex-col items-start gap-2">
            <InlineModeSelect
              label="Sposób rozliczenia materiałów"
              value="gross"
              onValueChange={noop}
              options={PRICING_OPTIONS}
              description={PRICING_HINT}
            />
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="SettingsSection (h3 + podtytuł xs z InfoTooltip) + SimpleSelect variant toolbarSm — te same tryby co b, inna kontrolka (kopia markupu SettingsSection)"
        sources={[
          'src/components/kosztorys/summary/settings/settlement-mode-select.tsx:28',
          'src/components/kosztorys/summary/settings/materials-net-pricing-control.tsx:38',
        ]}
      >
        <section className="flex flex-col items-start gap-2 px-4 py-3">
          <div className="flex flex-col items-start gap-0.5">
            <h3 className={SUBSECTION_TITLE_CLASS}>Materiały</h3>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              Sposób rozliczenia materiałów
              <InfoTooltip content={PRICING_HINT} label="Więcej o: Sposób rozliczenia materiałów" />
            </div>
          </div>
          <SimpleSelect
            value="gross"
            onValueChange={noop}
            options={PRICING_OPTIONS}
            variant="toolbarSm"
          />
        </section>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="variant muted na górze listy, bez aria-label (zgłoszenia prac: div flex-col gap-3)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:40',
          'src/components/nav/ui-scale-switch.tsx:43',
        ]}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <ToggleGroup
            options={[
              { value: 'date', label: 'Wg daty' },
              { value: 'worker', label: 'Wg pracownika' },
            ]}
            value="date"
            onChange={noop}
            variant="muted"
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="variant muted z samymi ikonami size-4 (etykieta w tooltipie) — tabela/karty transakcji"
        sources={['src/components/transfers/cards/transfer-view-switch.tsx:23']}
      >
        <ToggleGroup
          variant="muted"
          value="table"
          onChange={noop}
          options={[
            { value: 'table', label: 'Tabela', icon: <Table2 className="size-4" /> },
            { value: 'list', label: 'Karty', icon: <LayoutList className="size-4" /> },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="size md isEqualWidth w siatce grid gap-4 (zamówienie)"
        sources={['src/components/orders/order-pick-step.tsx:103']}
      >
        <div className="grid w-full max-w-sm gap-4">
          <ToggleGroup
            aria-label="Co zamawiasz"
            options={[
              { value: 'bigBag', label: 'big bag' },
              { value: 'container', label: 'kontener' },
            ]}
            value="bigBag"
            onChange={noop}
            size="md"
            isEqualWidth
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="size lg isEqualWidth w dolnym pasku nav (raport pracownika; w źródle fixed inset-x-0 bottom-0 z-40 przez portal — tu bez fixed, żeby został w karcie)"
        sources={['src/components/kosztorys/worker-report/report-mode-footer.tsx:21']}
      >
        <nav className="border-border bg-background flex w-full justify-center border-t px-4 py-3">
          <ToggleGroup
            size="lg"
            isEqualWidth
            options={[
              { value: 'report', label: 'Zgłaszam pracę' },
              { value: 'summary', label: 'Inwestycja' },
            ]}
            value="report"
            onChange={noop}
          />
        </nav>
      </AuditVariant>
    </AuditGroup>
  )
}
