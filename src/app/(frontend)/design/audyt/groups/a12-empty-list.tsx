import { SheetIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A12EmptyListGroup() {
  return (
    <AuditGroup
      id="A12"
      title="Komunikat pustej listy"
      count="37 wystąpień w 33 plikach · 12 wersji"
      drift={[
        'Prymityw: EmptyState size="inline" (b, d, f) vs Description z ikoną lub bez vs gołe <p> / <span> vs <td> w EmptyRow tabel.',
        'Wyrównanie i odstęp: EmptyState wyśrodkowany z py-8 (nadpisywanym na py-4 albo px-4 py-6); Description i <p> stoją do lewej bez odstępu.',
        'Rozmiar tekstu: text-sm vs size="xs" (historia floty, menu pracowników, odbiorcy powiadomień).',
        'Ikona: Description z ikoną „i” w trzech miejscach, bez ikony w pozostałych.',
        'Ton: dwa puste stany w kolorze błędu (protokół odbioru, odbiorcy powiadomień), reszta wyszarzona.',
      ]}
      proposal={
        <>
          Każda pusta lista przez <code>EmptyState</code>: dodać{' '}
          <code>{"align?: 'center' | 'start'"}</code> (start = do lewej, bez <code>py-8</code>) i
          jeden zwarty wariant w miejsce ręcznych <code>py-4</code> / <code>px-4 py-6</code>;
          przypadki z ostrzeżeniem zostają na <code>{'Description tone="error"'}</code>, a{' '}
          <code>EmptyRow</code> tabel może renderować <code>{'EmptyState size="inline"'}</code> w
          komórce.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="Description withIcon={false} (text-sm, do lewej)"
        sources={[
          'src/components/kosztorys/summary/tabs/summary-deposits-tab.tsx:21',
          'src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:93',
          'src/components/kosztorys/summary/tabs/summary-stages-tab.tsx:39',
          'src/components/kosztorys/editor/history/history-dialog.tsx:29',
          'src/components/leads/lead-assets-dialog.tsx:144',
          'src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:106',
          'src/components/orders/order-pick-step.tsx:161',
          'src/components/dialogs/link-sheet-to-investment-dialog.tsx:61',
          'src/components/kosztorys/editor/history/history-banner.tsx:41',
        ]}
      >
        <Description withIcon={false}>Brak wpłat.</Description>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={'wzorzec: EmptyState size="inline" bez className'}
        sources={[
          'src/components/transfers/duplicate-finder-dialog.tsx:141',
          'src/components/sheets/sync-button.tsx:144',
          'src/components/forms/settle-payouts-form/settle-payouts-form.tsx:225',
          'src/components/transfers/cards/transfer-card-list.tsx:20',
          'src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:92',
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:119',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:30',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:385',
        ]}
      >
        <EmptyState size="inline" title="Brak zapisanych wersji." />
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={'EmptyState size="page" z opisem i przyciskiem (pusta siatka kosztorysu)'}
        sources={[
          'src/components/kosztorys/editor/grid/grid-empty-overlay.tsx:42',
          'src/components/kosztorys/editor/grid/grid-empty-overlay.tsx:62',
          'src/components/kosztorys/editor/grid/grid-empty-overlay.tsx:77',
          'src/components/trash/trash-contents.tsx:7',
          'src/components/company-knowledge/company-knowledge-book.tsx:195',
        ]}
      >
        <EmptyState
          title="Kosztorys jest pusty"
          description={'Dodaj sekcję lub etap z menu „Dodaj" powyżej.'}
        >
          <Button variant="outline" size="sm" className="pointer-events-auto">
            <SheetIcon />
            Pobierz z arkusza Google…
          </Button>
        </EmptyState>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={'EmptyState size="inline" className="px-4 py-6"'}
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:108',
          'src/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog.tsx:106',
          'src/components/kosztorys/editor/dialogs/catalogue/add-items-from-catalogue-dialog.tsx:213',
        ]}
      >
        <EmptyState size="inline" title="Katalog prac jest pusty." className="px-4 py-6" />
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="Description z domyślną ikoną „i”"
        sources={[
          'src/components/equipment/equipment-history.tsx:55',
          'src/components/users/owned-registers-section.tsx:48',
          'src/components/users/worker-investments-section.tsx:34',
        ]}
      >
        <Description>Brak wpisów — sprzęt nie był jeszcze nikomu przekazany.</Description>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={'EmptyState size="inline" className="py-4" (brak wyników wyszukiwania)'}
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:130',
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:127',
        ]}
      >
        <EmptyState size="inline" title="Nie znaleziono szablonu." className="py-4" />
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={'Description withIcon={false} size="xs"'}
        sources={[
          'src/components/fleet/inspection-history.tsx:110',
          'src/components/fleet/vehicle-costs.tsx:38',
        ]}
      >
        <Description withIcon={false} size="xs">
          Brak wpisów w wybranym okresie
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="komórka <td> EmptyRow — każda pusta DataTable (zwykła i wirtualizowana)"
        sources={['src/components/tables/data-table/empty-row.tsx:7']}
      >
        <table className="w-full">
          <tbody>
            <tr>
              <td colSpan={3} className="text-muted-foreground px-4 py-8 text-center">
                Brak danych
              </td>
            </tr>
          </tbody>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label={'Description withIcon={false} size="xs" className="px-2 py-1.5" (w menu)'}
        sources={['src/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.tsx:62']}
      >
        <Description withIcon={false} size="xs" className="px-2 py-1.5">
          Żaden etap nie ma przypisanego pracownika.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label={'Description tone="error" withIcon (text-sm)'}
        sources={['src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx:168']}
      >
        <Description tone="error" withIcon>
          Żadna pozycja nie ma jeszcze wykonanej pracy — uzupełnij etapy w kosztorysie.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label={'Description tone="error" withIcon size="xs" className="mt-2"'}
        sources={['src/components/notification-recipients/recipient-list-card.tsx:58']}
      >
        <Description tone="error" withIcon size="xs" className="mt-2">
          Nikt nie dostanie tych powiadomień — wysyłka zgłosi błąd.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="goły wyszarzony <span> (wyszukiwanie w katalogu)"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx:145',
        ]}
      >
        <span className="text-muted-foreground">Nic takiego w katalogu.</span>
      </AuditVariant>
    </AuditGroup>
  )
}
