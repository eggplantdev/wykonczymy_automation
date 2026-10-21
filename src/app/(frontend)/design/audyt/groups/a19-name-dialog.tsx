import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const DIALOG_BOX = 'flex w-full flex-col gap-4 rounded-lg border p-4'
const DIALOG_TITLE = 'text-lg font-semibold'

export function A19NameDialogGroup() {
  return (
    <AuditGroup
      id="A19"
      title="Dialog z jednym polem nazwy"
      count="5 wystąpień w 5 plikach · 3 wersje"
      drift={[
        'Warunek wysłania Enterem różni się od warunku przycisku: raz ten sam `canSave`, raz tylko `!pending` (Enter wysyła pustą nazwę, choć przycisk jest zablokowany).',
        'Etykieta pola: `aria-label` w trzech miejscach, sam `placeholder` w dwóch.',
        'Stan w trakcie: „Zakładam…” / „Zapisuję…” / „Usuwam…” ze spinnerem, a dwa zapisy (wersja, szablon) nie przekazują `pending` i nie mają spinnera.',
        'Obsługa Entera przepisana pięć razy: inline `onKeyDown` raz jako łańcuch `&&`, raz jako blok `if` z `void handleSave()`.',
      ]}
      proposal={
        <>
          <code>NameInputDialog title label confirmLabel pendingLabel canSubmit onSubmit</code> na{' '}
          <code>FormDialogShell</code> albo samo <code>SubmitOnEnterInput canSubmit onSubmit</code>{' '}
          — jeden warunek dla Entera i przycisku, zawsze <code>aria-label</code> i spinner.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="zapis wersji/szablonu: sam placeholder, Enter i przycisk na tym samym canSave, bez pending — bez spinnera (dialog odtworzony statycznie)"
        sources={[
          'src/components/kosztorys/editor/dialogs/save-version-dialog.tsx:52',
          'src/components/kosztorys/editor/dialogs/preset/save-preset-dialog.tsx:94',
        ]}
      >
        <div className={DIALOG_BOX}>
          <h2 className={DIALOG_TITLE}>Zapisz wersję</h2>
          <Input defaultValue="Po rozmowie z klientem" placeholder="Nazwa wersji" />
          <DialogFooter>
            <Button variant="outline">Anuluj</Button>
            <Button>Zapisz</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="nowy szablon: aria-label, Enter i przycisk na tym samym canSave, pending „Zakładam…” (dialog odtworzony statycznie)"
        sources={[
          'src/components/presets/create-empty-preset-dialog.tsx:47',
          'src/components/trash/delete-forever-dialog.tsx:59',
        ]}
      >
        <div className={DIALOG_BOX}>
          <h2 className={DIALOG_TITLE}>Nowy szablon</h2>
          <Input defaultValue="Łazienka standard" aria-label="Nazwa szablonu" />
          <DialogFooter>
            <Button variant="outline">Anuluj</Button>
            <Button>Załóż</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="zmiana nazwy szablonu: aria-label, Enter sprawdza tylko !pending — wysyła pustą nazwę, przycisk zablokowany (dialog odtworzony statycznie)"
        sources={['src/components/presets/preset-row-actions.tsx:57']}
      >
        <div className={DIALOG_BOX}>
          <h2 className={DIALOG_TITLE}>Zmień nazwę szablonu</h2>
          <Input defaultValue="" aria-label="Nazwa szablonu" />
          <DialogFooter>
            <Button variant="outline">Anuluj</Button>
            <Button disabled>Zapisz</Button>
          </DialogFooter>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
