import { FileSpreadsheet, Plus, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A05AddButtonGroup() {
  return (
    <AuditGroup
      id="A05"
      title="Przycisk „Dodaj”"
      count="26 wystąpień w 26 plikach · 10 wersji"
      drift={[
        'ikona: Plus, PlusIcon, Plus z ręcznym size-4, FileSpreadsheet albo brak ikony; w menu „Dodaj” kosztorysu ikona stoi za etykietą',
        'wariant: outline, ghost albo domyślny wypełniony',
        'rozmiar: sm, xs, domyślny albo z propa',
        'doklejone odstępy w miejscu użycia: mt-3, ml-auto, font-normal',
        'etykieta: „Dodaj”, „Nowy X”, „Dodaj X” albo goły rzeczownik („Pojazd”, „Sprzęt”, „Przegląd”)',
      ]}
      proposal={
        <>
          <code>AddButton</code> dostaje <code>variant?</code> (domyślnie <code>outline</code>) i{' '}
          <code>size?</code> (domyślnie <code>sm</code>) dla pozostałych wersji — ikona zawsze przed
          etykietą, odstępy nadaje rodzic.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="outline sm + Plus przed etykietą (kanoniczny)"
        sources={[
          'src/components/dialogs/add-cash-register-dialog.tsx:20',
          'src/components/dialogs/add-catalogue-item-dialog.tsx:20',
          'src/components/dialogs/add-inspection-dialog.tsx:39',
          'src/components/dialogs/add-investment-dialog.tsx:15',
          'src/components/dialogs/add-vehicle-dialog.tsx:23',
          'src/components/dialogs/add-equipment-dialog.tsx:37',
          'src/components/dialogs/add-worker-dialog.tsx:30',
          'src/components/sheets/kosztorys-data-table.tsx:35',
          'src/components/company-knowledge/company-knowledge-book.tsx:180',
          'src/components/presets/create-empty-preset-dialog.tsx:34',
          'src/components/kosztorys/worker-report/extra-works-dialog-button.tsx:41',
          'src/components/kosztorys/worker-report/extra-work-rows.tsx:70',
        ]}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Plus />
            Dodaj
          </Button>
          <Button variant="outline" size="sm">
            <Plus />
            Pojazd
          </Button>
          <Button variant="outline" size="sm">
            <Plus />
            Nowa praca (2)
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="outline sm bez ikony"
        sources={[
          'src/components/forms/order-settings-form/order-settings-form.tsx:154',
          'src/components/forms/recipient-list-form/recipient-list-form.tsx:74',
          'src/components/forms/expense-form/line-items-field.tsx:404',
        ]}
      >
        <Button type="button" variant="outline" size="sm">
          Dodaj dostawcę
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="wypełniony, domyślny rozmiar, bez ikony"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/add-items-from-catalogue-dialog.tsx:221',
          'src/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog.tsx:117',
        ]}
      >
        <Button>Dodaj nową pracę…</Button>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="wypełniony, domyślny rozmiar + Plus; className z jedynego wywołania (h-auto min-h-11 whitespace-normal)"
        sources={['src/components/worker-expenses/expense-draft-dialog.tsx:130']}
      >
        <Button className="h-auto min-h-11 whitespace-normal">
          <Plus />
          Wydatek
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="ghost sm + Plus z ręcznym size-4"
        sources={['src/components/forms/form-fields/warehouse-field.tsx:54']}
      >
        <Button type="button" variant="ghost" size="sm">
          <Plus className="size-4" />
          Nowy magazyn
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="f"
        label="ghost xs + Plus + font-normal (nagłówek sekcji w siatce)"
        sources={['src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:143']}
      >
        <Button variant="ghost" size="xs" className="font-normal">
          <Plus />
          Dodaj pracę
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="g"
        label="outline xs + PlusIcon (alias)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:371',
        ]}
      >
        <Button variant="outline" size="xs">
          <PlusIcon />
          Dodaj do rozpiski
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="h"
        label="outline sm, ikona Plus ZA etykietą"
        sources={['src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx:41']}
      >
        <Button size="sm" variant="outline">
          Dodaj
          <Plus />
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="i"
        label="outline xs bez ikony"
        sources={['src/components/leads/promote-lead-dialog.tsx:80']}
      >
        <Button variant="outline" size="xs">
          Dodaj
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="j"
        label="outline, rozmiar z propa (domyślnie xs) + FileSpreadsheet"
        sources={['src/components/investments/sheet-button.tsx:28']}
      >
        <Button size="xs" variant="outline">
          <FileSpreadsheet />
          Dodaj
        </Button>
      </AuditVariant>
    </AuditGroup>
  )
}
