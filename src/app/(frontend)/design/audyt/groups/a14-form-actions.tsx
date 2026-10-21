'use client'

import { ArrowRightLeft, Bell, Download, FileSearch, KeyRound, Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogActions } from '@/components/ui/dialog-actions'
import { DialogFooter } from '@/components/ui/dialog'
import { InfoList } from '@/components/ui/info-list'
import { Input } from '@/components/ui/input'
import { RemoveButton } from '@/components/ui/remove-button'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

export function A14FormActionsGroup() {
  return (
    <AuditGroup
      id="A14"
      title="Przyciski formularza i stopka"
      count="94 wystąpienia w 71 plikach · 20 wersji"
      drift={[
        'Etykieta w trakcie zapisu w trzech gramatykach i dwóch interpunkcjach: „Zapisywanie...” (ASCII), „Zapisywanie…” (wielokropek) i „Zapisuję…” (1. osoba) — dla tej samej czynności.',
        'Stan oczekiwania: `pending` (spinner + disabled) vs samo `disabled` z podmianą tekstu; `FormFooter` nigdy nie pokazuje spinnera.',
        'Stopka dialogu: `DialogActions` (outline „Anuluj” + potwierdzenie) vs ręczne `DialogFooter` z jednym przyciskiem bez „Anuluj”, z dwoma `size="sm"` albo z podsumowaniem `mr-auto` po lewej.',
        'Stopka formularza: `className="mt-6"` w 18 miejscach, raz `mt-6` + `align="end"`.',
        'Zapis/anuluj w linii: „Anuluj” raz `ghost` i zawsze aktywny, raz `outline` i blokowany w trakcie; usuwanie osoby: `ghost size="xs"` zamiast `RemoveButton` (`ghostDestructive`, `shrink-0`).',
        'Pasek akcji na stronie szczegółów: nad listą informacji (kasa, pracownik) albo pod nią (sprzęt), albo obok w `justify-between` (flota); rozmiary przycisków mieszają `sm` i domyślny.',
      ]}
      proposal={
        <>
          Jedna stała etykieta w trakcie (np. <code>common.saving</code> = „Zapisywanie…”) i zawsze{' '}
          <code>pending</code> zamiast ręcznej podmiany tekstu, stopki dialogów przez{' '}
          <code>DialogActions</code> (z opcjonalnym <code>summary</code> i wariantem bez „Anuluj”),
          usuwanie wiersza przez <code>RemoveButton</code>, a pasek akcji szczegółów jako{' '}
          <code>DetailActions</code> w stałym miejscu nad <code>InfoList</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="etykieta w trakcie: rzeczownik odczasownikowy + trzy kropki ASCII „...”"
        sources={[
          'src/components/forms/equipment-transfer-form/equipment-transfer-form.tsx:91',
          'src/components/forms/order-settings-form/order-settings-form.tsx:165',
          'src/components/forms/recipient-list-form/recipient-list-form.tsx:85',
          'src/components/forms/edit-transfer-form/edit-transfer-form.tsx:249',
          'src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx:176',
          'src/components/dialogs/add-inspection-dialog.tsx:48',
          'src/components/dialogs/edit-equipment-dialog.tsx:44',
          'src/components/dialogs/edit-cash-register-dialog.tsx:39',
          'src/components/dialogs/edit-investment-dialog.tsx:84',
          'src/components/dialogs/edit-catalogue-item-dialog.tsx:57',
          'src/components/dialogs/edit-worker-dialog.tsx:47',
          'src/components/dialogs/edit-vehicle-dialog.tsx:41',
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog.tsx:91',
          'src/app/(auth)/zaloguj/reset-hasla/reset-password-form.tsx:107',
          'src/components/forms/form-fields/warehouse-field.tsx:91',
          'src/components/investments/investment-notes.tsx:75',
          'src/components/forms/equipment-form/add-equipment-form.tsx:89',
          'src/components/dialogs/add-cash-register-dialog.tsx:28',
          'src/components/dialogs/add-vehicle-dialog.tsx:31',
          'src/components/dialogs/add-catalogue-item-dialog.tsx:31',
          'src/components/dialogs/add-investment-dialog.tsx:25',
          'src/components/dialogs/add-worker-dialog.tsx:38',
          'src/components/leads/promote-lead-dialog.tsx:118',
          'src/components/transfers/cancel-transfer-button.tsx:86',
          'src/app/(auth)/zaloguj/login-form.tsx:80',
          'src/app/(auth)/zaloguj/zapomniane-haslo/forgot-password-form.tsx:63',
          'src/components/worker-expenses/expense-draft-dialog.tsx:202',
        ]}
      >
        <Button pending>Zapisywanie...</Button>
        <Button pending>Dodawanie...</Button>
        <Button pending>Tworzenie...</Button>
        <Button pending>Wysyłanie...</Button>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="etykieta w trakcie: 1. osoba czasu teraźniejszego + wielokropek „…”"
        sources={[
          'src/components/forms/settle-payouts-form/settle-payouts-form.tsx:259',
          'src/components/presets/preset-row-actions.tsx:55',
          'src/components/kosztorys/editor/dialogs/reorder/reorder-dialog.tsx:360',
          'src/components/kosztorys/editor/dialogs/catalogue/work-note-dialog.tsx:42',
          'src/components/trash/delete-forever-dialog.tsx:57',
          'src/components/presets/create-empty-preset-dialog.tsx:45',
          'src/components/kosztorys/editor/dialogs/clear-kosztorys-dialog.tsx:51',
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:112',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx:125',
          'src/components/dialogs/add-sheet-dialog.tsx:126',
          'src/components/dialogs/sheet-setup-dialog.tsx:86',
          'src/components/dialogs/link-sheet-to-investment-dialog.tsx:84',
          'src/components/work-catalogue/fill-catalogue-translations-button.tsx:31',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:336',
          'src/components/sheets/sync-button.tsx:108',
          'src/components/work-catalogue/fill-catalogue-translations-button.tsx:28',
          'src/components/sheets/sync-button.tsx:98',
          'src/components/dialogs/add-sheet-dialog.tsx:125',
          'src/components/dialogs/link-sheet-to-investment-dialog.tsx:79',
          'src/components/dialogs/sheet-setup-dialog.tsx:79',
        ]}
      >
        <Button pending>Zapisuję…</Button>
        <Button pending>Usuwam…</Button>
        <Button pending>Sprawdzam…</Button>
        <Button pending>Pobieram…</Button>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label='FormFooter className="mt-6" — submit bez spinnera, samo disabled (dwa miejsca dokładają outline „Anuluj”; bez kontekstu formularza — odtworzony statycznie)'
        sources={[
          'src/components/forms/equipment-transfer-form/equipment-transfer-form.tsx:91',
          'src/components/forms/equipment-form/add-equipment-form.tsx:89',
          'src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:121',
          'src/components/forms/vehicle-form/vehicle-form.tsx:117',
          'src/components/forms/equipment-form/equipment-form.tsx:63',
          'src/components/forms/worker-form/worker-form.tsx:127',
          'src/components/forms/cash-register-form/cash-register-form.tsx:104',
          'src/components/forms/internal-transfer-form/internal-transfer-form.tsx:113',
          'src/components/forms/deposit-form/deposit-form.tsx:224',
          'src/components/forms/inspection-form/inspection-form.tsx:228',
          'src/components/forms/request-review-form/request-review-form.tsx:48',
          'src/components/forms/edit-transfer-form/edit-transfer-form.tsx:247',
          'src/components/forms/account-credentials-form/account-credentials-form.tsx:86',
          'src/components/forms/settle-payouts-form/settle-payouts-form.tsx:256',
          'src/components/forms/investment-form/investment-form.tsx:377',
          'src/components/forms/recipient-list-form/recipient-list-form.tsx:85',
          'src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx:174',
          'src/components/forms/expense-form/expense-form.tsx:499',
        ]}
      >
        <footer className="mt-6">
          <div className="flex items-center gap-4">
            <Button type="submit">Zapisz</Button>
          </div>
        </footer>
        <footer className="mt-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" type="button">
              Anuluj
            </Button>
            <Button disabled type="submit">
              Zapisywanie...
            </Button>
          </div>
        </footer>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="etykieta w trakcie: rzeczownik odczasownikowy + wielokropek „…” (m.in. common.saving)"
        sources={[
          'src/components/forms/account-credentials-form/account-credentials-form.tsx:88',
          'src/stores/optimistic-form-store.ts:63',
          'src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts:129',
          'src/components/forms/request-review-form/request-review-form.tsx:50',
          'src/components/kosztorys/worker-report/send-bar.tsx:87',
          'src/components/leads/lead-assets-dialog.tsx:196',
          'src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:175',
          'src/components/worker-reports/scan-report-dialog.tsx:238',
          'src/components/leads/lead-assets-dialog.tsx:190',
        ]}
      >
        <Button pending>Zapisywanie…</Button>
        <Button pending>Wysyłanie…</Button>
        <Button pending>Przywracanie…</Button>
        <Button pending>Odczytywanie kartki…</Button>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="ręczna podmiana tekstu bez pending — disabled, bez spinnera"
        sources={[
          'src/components/forms/form-fields/warehouse-field.tsx:90',
          'src/components/investments/investment-notes.tsx:74',
          'src/components/worker-reports/scan-report-dialog.tsx:237',
          'src/components/worker-expenses/expense-draft-dialog.tsx:201',
          'src/components/kosztorys/worker-report/send-bar.tsx:83',
          'src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:174',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:330',
        ]}
      >
        <Button type="button" size="sm" disabled>
          Zapisywanie...
        </Button>
        <Button disabled>Wysyłanie...</Button>
        <Button size="sm" variant="outline" disabled>
          Przywracanie…
        </Button>
        <Button variant="link" size="inlineXs" disabled>
          Tłumaczę…
        </Button>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="ręczne DialogFooter: jeden przycisk z pending, bez „Anuluj”"
        sources={[
          'src/components/dialogs/add-sheet-dialog.tsx:124',
          'src/components/dialogs/link-sheet-to-investment-dialog.tsx:78',
        ]}
      >
        <div className="w-full">
          <DialogFooter>
            <Button pending>Sprawdzam…</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="ręczne DialogFooter: jeden przycisk bez pending, tekst podmieniany ręcznie, bez „Anuluj”"
        sources={[
          'src/components/worker-expenses/expense-draft-dialog.tsx:200',
          'src/components/worker-reports/scan-report-dialog.tsx:236',
        ]}
      >
        <div className="w-full">
          <DialogFooter>
            <Button disabled>Wysyłanie...</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label='FormFooter className="mt-6" align="end" — przycisk do prawej'
        sources={['src/components/forms/order-settings-form/order-settings-form.tsx:165']}
      >
        <div className="w-full">
          <footer className="mt-6">
            <div className="flex items-center justify-end gap-4">
              <Button type="submit">Zapisz</Button>
            </div>
          </footer>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label='ręczne DialogFooter: jeden przycisk size="sm" „Zapisz”, bez „Anuluj”'
        sources={[
          'src/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx:98',
        ]}
      >
        <div className="w-full">
          <DialogFooter>
            <Button size="sm">Zapisz</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label='ręczne DialogFooter: dwa przyciski size="sm" (outline + domyślny), bez „Anuluj”'
        sources={[
          'src/components/kosztorys/editor/dialogs/view-settings/kosztorys-client-view-dialog.tsx:73',
        ]}
      >
        <div className="w-full">
          <DialogFooter>
            <Button variant="outline" size="sm">
              Zapisz jako domyślne
            </Button>
            <Button size="sm">Zapisz</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="ręczne DialogFooter: podsumowanie mr-auto po lewej + jeden przycisk"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:451',
        ]}
      >
        <div className="w-full">
          <DialogFooter>
            <p className="text-foreground mr-auto self-center text-sm">3 przyjęte, 1 odrzucona</p>
            <Button>Przyjmij 3 pozycje</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="zapis/anuluj w linii pola: „Anuluj” ghost, zawsze aktywny; bez własnego wrappera"
        sources={['src/components/forms/form-fields/warehouse-field.tsx:90']}
      >
        <Input defaultValue="Magazyn Wola" className="w-48" />
        <Button type="button" size="sm">
          Zapisz
        </Button>
        <Button type="button" variant="ghost" size="sm">
          Anuluj
        </Button>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="zapis/anuluj pod notatką: div.flex gap-2, „Anuluj” outline, blokowany w trakcie"
        sources={['src/components/investments/investment-notes.tsx:73']}
      >
        <div className="flex gap-2">
          <Button size="sm">Zapisz</Button>
          <Button size="sm" variant="outline">
            Anuluj
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="Przyjmij/Odrzuć przy pozycji paragonu: div.flex shrink-0 gap-2"
        sources={['src/components/forms/expense-form/line-items-field.tsx:306']}
      >
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm">
            Przyjmij
          </Button>
          <Button type="button" variant="destructive" size="sm">
            Odrzuć
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="Przyjmij/Odrzuć zaznaczone: fragment w rodzicu flex-wrap justify-end gap-2"
        sources={['src/components/forms/expense-form/receipt-selection-actions.tsx:21']}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm">
            Przyjmij zaznaczone
          </Button>
          <Button type="button" variant="destructive" size="sm">
            Odrzuć zaznaczone
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label='usuwanie osoby: ghost size="xs" z <X /> zamiast RemoveButton'
        sources={['src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:71']}
      >
        <span className="text-sm">Jan Kowalski · 50%</span>
        <Button variant="ghost" size="xs" aria-label="Usuń Jan Kowalski">
          <X />
        </Button>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="pasek akcji kasy: nad InfoList, Edytuj sm + Sprawdź faktury w rozmiarze domyślnym (przyciski dialogów odtworzone statycznie)"
        sources={['src/app/(frontend)/kasa/[id]/page.tsx:62']}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline">
              <Pencil />
              <span>Edytuj</span>
            </Button>
            <Button variant="outline">
              <FileSearch />
              Sprawdź faktury
            </Button>
          </div>
          <InfoList items={[{ label: 'Właściciel', value: 'Jan Kowalski' }]} />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="pasek akcji pracownika: nad InfoList, każdy przycisk w-fit (instalacja ma sm:hidden — w podglądzie pominięte; przyciski odtworzone statycznie)"
        sources={['src/app/(frontend)/pracownicy/[id]/page.tsx:149']}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="w-fit">
              <Pencil />
              <span>Edytuj</span>
            </Button>
            <Button size="sm" variant="outline" className="w-fit">
              <KeyRound />
              <span>Zmień e-mail lub hasło</span>
            </Button>
            <Button size="sm" variant="outline" className="w-fit">
              <Download />
              Zainstaluj aplikację
            </Button>
            <Button size="sm" variant="outline" className="w-fit">
              <Bell />
              Włącz powiadomienia
            </Button>
          </div>
          <InfoList items={[{ label: 'Rola', value: 'Pracownik' }]} />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="s"
        label="pasek akcji sprzętu: pod InfoList (przyciski dialogów odtworzone statycznie)"
        sources={['src/app/(frontend)/sprzet/[id]/page.tsx:73']}
      >
        <div className="flex w-full flex-col gap-4">
          <InfoList items={[{ label: 'Lokalizacja', value: 'Magazyn Wola' }]} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline">
              <ArrowRightLeft />
              <span>Przekaż</span>
            </Button>
            <Button size="sm" variant="outline">
              <Pencil />
              <span>Edytuj</span>
            </Button>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="t"
        label="pasek akcji floty: obok InfoList w flex justify-between (przyciski dialogów odtworzone statycznie)"
        sources={['src/app/(frontend)/flota/[id]/page.tsx:81']}
      >
        <div className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <InfoList items={[{ label: 'VIN', value: 'WVWZZZ1KZAW000001' }]} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline">
              <Pencil />
              <span>Edytuj</span>
            </Button>
            <Button variant="outline" size="sm">
              <Plus />
              Przegląd
            </Button>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="W"
        label="wzorzec: DialogActions (ui/) — outline „Anuluj” + potwierdzenie z pending"
        sources={['src/components/ui/dialog-actions.tsx:19']}
      >
        <div className="w-full">
          <DialogActions
            confirmLabel="Zapisz"
            onConfirm={noop}
            onCancel={noop}
            pending
            pendingLabel="Zapisywanie…"
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="W2"
        label="wzorzec: RemoveButton (ui/) — ghostDestructive, size icon, shrink-0"
        sources={['src/components/ui/remove-button.tsx:14']}
      >
        <RemoveButton onClick={noop} />
      </AuditVariant>
    </AuditGroup>
  )
}
