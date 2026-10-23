'use client'

import { ArrowDownToLine, ArrowUpToLine, Trash2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const FILE_TRASH_NOTICE =
  'Usunięte pliki trafią do Kosza na 7 dni — do tego czasu można je przywrócić.'
const REMOVAL_CONFIRM_DESCRIPTION =
  'Usunięte zostaną też wpisane ilości etapów. Cofnięcie w edytorze nie zadziała — przywrócisz je tylko z zapisanej wersji.'

export function A39DeleteConfirmGroup() {
  return (
    <AuditGroup
      id="A39"
      title="Potwierdzenie usunięcia / kosz"
      count="21 wystąpień w 23 plikach · 8 wersji"
      drift={[
        'TrashRowButton istnieje (6 tabel), a zgłoszenia i inwestycja składają ten sam przycisk + ConfirmDialog od nowa.',
        'Wyzwalacz mówi „Usuń inwestycję” / „Usuń sprzęt”, a potwierdzenie „Przenieś do kosza”; w plikach, katalogu i kosztorysie „Usuń” znaczy faktyczne usunięcie albo kosz na 7 dni.',
        'Wariant: neutral (szary przycisk) dla kosza, alert (czerwony) dla usunięcia — ale inwestycja przełącza się między nimi zależnie od kosztorysu, a pliki trafiające do Kosza dostają alert.',
        'Opis: zawsze w plikach i kosztorysie, nazwa inwestycji jako jedyny opis przy wydatku, brak opisu w Wiedzy firmy; katalog ma opis z listą szablonów.',
        'Cudzysłowy w tytułach: „…" (sekcja, etap, inwestycja) vs „…” (Wiedza firmy).',
        'Wyzwalacz: ikonowy DeleteButton (większość), Button outline sm z licznikiem (zgłoszenia), pozycja destructive w menu wiersza/sekcji/etapu.',
      ]}
      proposal={
        <>
          Dwa gotowe wzorce: <code>TrashRowButton</code> (kosz,{' '}
          <code>variant=&quot;neutral&quot;</code>, „Przenieś do kosza”, z <code>trigger?</code> dla
          przycisku z licznikiem) i <code>DeleteConfirm</code> (trwałe usunięcie,{' '}
          <code>variant=&quot;alert&quot;</code>, „Usuń”, wymagany <code>description</code>); tytuł
          zawsze z <code>quoteName()</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="TrashRowButton: ikonowy DeleteButton + ConfirmDialog neutral „Przenieść do kosza?” / „Przenieś do kosza”, opis od wywołującego (tu: sprzęt)"
        sources={[
          'src/components/trash/trash-row-button.tsx:40',
          'src/components/tables/equipment.tsx:107',
          'src/components/tables/users.tsx:168',
          'src/components/tables/fleet.tsx:101',
          'src/components/tables/cash-registers.tsx:61',
          'src/components/tables/leads.tsx:141',
          'src/components/presets/preset-row-actions.tsx:38',
        ]}
      >
        <DeleteButton label="Usuń sprzęt" onClick={noop} />
        <OpenPreview>
          <ConfirmDialog
            open
            title="Przenieść do kosza?"
            description='Przenieść „Młot udarowy Bosch" do kosza? Możesz go przywrócić z Kosza.'
            confirmLabel="Przenieś do kosza"
            variant="neutral"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="usuwanie pliku z podglądu: <ConfirmDialog {...removalConfirm} /> z hooka — alert, „Usuń”, opis FILE_TRASH_NOTICE, tytuł zależny od miejsca (tu: faktura)"
        sources={[
          'src/hooks/use-media-removal.ts:97',
          'src/components/forms/edit-transfer-form/edit-transfer-form.tsx:256',
          'src/components/leads/lead-assets-dialog.tsx:216',
          'src/components/leads/promote-lead-dialog.tsx:124',
          'src/components/transfers/invoice-cell.tsx:86',
          'src/components/investments/investment-assets-control.tsx:75',
        ]}
      >
        <OpenPreview>
          <ConfirmDialog
            open
            title="Czy na pewno chcesz usunąć fakturę?"
            description={FILE_TRASH_NOTICE}
            confirmLabel="Usuń"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="ikonowy DeleteButton + ConfirmDialog alert „Usuń” z opisem trwałego usunięcia (tu: kosztorys; katalog z listą szablonów w opisie; wydatek z nazwą inwestycji jako opisem)"
        sources={[
          'src/components/work-catalogue/catalogue-row-actions.tsx:38',
          'src/components/sheets/linked-sheet-actions.tsx:62',
          'src/components/worker-expenses/delete-expense-draft-button.tsx:35',
        ]}
      >
        <DeleteButton label="Usuń kosztorys" onClick={noop} />
        <OpenPreview>
          <ConfirmDialog
            open
            title="Usunąć kosztorys?"
            description="Usunięty zostanie tylko wpis w aplikacji. Arkusz Google pozostanie nienaruszony na Dysku. Tej operacji nie można cofnąć."
            confirmLabel="Usuń"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="pozycja destructive w menu komórki (CellMenuTrigger, min-w-44) → ConfirmDialog alert „Usuń” z REMOVAL_CONFIRM_DESCRIPTION (tu: wiersz; sekcja z liczbą pozycji; etap z własnym opisem) — pozycje-komponenty funkcji pominięte"
        sources={[
          'src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx:59',
          'src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx:89',
          'src/components/kosztorys/editor/grid/stage-header.tsx:177',
        ]}
      >
        <OpenPreview backdrop={false} className="h-56 justify-start">
          <div className="border-border size-8 rounded-sm border">
            <DropdownMenu>
              <CellMenuTrigger title="Akcje wiersza" />
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuLabel>Praca</DropdownMenuLabel>
                <DropdownMenuItem>
                  <ArrowUpToLine />
                  Wstaw powyżej
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArrowDownToLine />
                  Wstaw poniżej
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive">
                  <Trash2 />
                  Usuń pozycję
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </OpenPreview>
        <OpenPreview>
          <ConfirmDialog
            open
            title='Usunąć sekcję „Łazienka" (12 poz.)?'
            description={REMOVAL_CONFIRM_DESCRIPTION}
            confirmLabel="Usuń"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="przebudowany TrashRowButton dla inwestycji: DeleteButton „Usuń inwestycję” (disabled w trakcie sprawdzania), ConfirmDialog „Przenieś do kosza” — alert, gdy kosztorys w użyciu (tu), inaczej neutral"
        sources={['src/components/investments/trash-investment-button.tsx:49']}
      >
        <DeleteButton label="Usuń inwestycję" onClick={noop} />
        <OpenPreview>
          <ConfirmDialog
            open
            title="Przenieść do kosza?"
            description='Kosztorys tej inwestycji jest w użyciu — ma wpisany przedmiar lub ilości na etapach. Przenieść „Mokotów, ul. Puławska 12" do kosza? Możesz ją przywrócić z Kosza.'
            confirmLabel="Przenieś do kosza"
            variant="alert"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="kosz zbiorczy zgłoszeń: Button outline sm z Trash2 i licznikiem + ConfirmDialog neutral „Przenieś do kosza”"
        sources={['src/components/leads/trash-leads-button.tsx:35']}
      >
        <Button variant="outline" size="sm">
          <Trash2 />
          Do kosza (3)
        </Button>
        <OpenPreview>
          <ConfirmDialog
            open
            title="Przenieść 3 zgłoszenia do kosza?"
            description="Trafią do kosza i po 30 dniach zostaną usunięte na zawsze. Inwestycje utworzone z tych zgłoszeń i ich pliki zostają nietknięte."
            confirmLabel="Przenieś do kosza"
            variant="neutral"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="Wiedza firmy: EditButton + DeleteButton „Usuń wpis” w ml-auto obok tytułu, ConfirmDialog alert bez opisu, tytuł z „…”"
        sources={[
          'src/components/company-knowledge/knowledge-entry-row.tsx:53',
          'src/components/company-knowledge/company-knowledge-book.tsx:221',
        ]}
      >
        <div className="flex w-full max-w-md items-center gap-2">
          <h3 className={SUBSECTION_TITLE_CLASS}>Odbiór prac u klienta</h3>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <EditButton label="Edytuj wpis" onClick={noop} />
            <DeleteButton label="Usuń wpis" onClick={noop} />
          </div>
        </div>
        <OpenPreview>
          <ConfirmDialog
            open
            title="Usunąć wpis „Odbiór prac u klienta”?"
            confirmLabel="Usuń"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="odłączenie zamiast usunięcia: RowActionButton Unlink + ConfirmDialog neutral „Odłącz” (obok w tym samym pliku wersja c)"
        sources={['src/components/sheets/linked-sheet-actions.tsx:56']}
      >
        <RowActionButton icon={Unlink} label="Odłącz od inwestycji" onClick={noop} />
        <OpenPreview>
          <ConfirmDialog
            open
            title="Odłączyć kosztorys od inwestycji?"
            description="Arkusz Google nie zostanie usunięty — pozostanie na liście jako kosztorys bez inwestycji i można go później powiązać ponownie."
            confirmLabel="Odłącz"
            variant="neutral"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>
    </AuditGroup>
  )
}
