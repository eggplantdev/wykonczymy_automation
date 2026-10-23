import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { ExternalLink } from '@/components/ui/external-link'
import { Input } from '@/components/ui/input'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const SERVICE_ACCOUNT = 'arkusze@przyklad-projekt.iam.gserviceaccount.com'
const SAMPLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

export function A26CopyableCodeGroup() {
  return (
    <AuditGroup
      id="A26"
      title="Adres do skopiowania"
      count="6 wystąpień w 4 plikach · 6 wersji"
      drift={[
        'chip <code>: px-1 py-0.5 vs px-2 py-1; select-all w dwóch, w trzecim brak; flex-1 tylko w jednym',
        'kopiowanie: ikonka iconSm z Copy size-3.5 vs przycisk sm „Kopiuj adres” vs brak przycisku vs Input readOnly + ikonka size icon (link udostępniania)',
        'etykieta „Konto usługi:” nad chipem (Description) vs w jednej linii z chipem vs brak',
        'instrukcja podpięcia arkusza: numerowana lista <ol> vs jedno zdanie w Description; tekst linku do ALL_SHEETS_URL: „Otwórz wszystkie arkusze ↗” / „Otwórz arkusze google ↗” (też /kosztorysy) / „Wszystkie kosztorysy ↗” (iframe-view)',
      ]}
      proposal={
        <>
          <code>CopyableCode</code> w <code>ui/</code> (props: <code>value</code>,{' '}
          <code>copyLabel?</code>, <code>inline?</code>) — jeden chip z <code>select-all</code> i
          jednym przyciskiem kopiowania; obie instrukcje podpięcia arkusza jako jeden blok{' '}
          <code>LinkSheetInstructions</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="chip px-1 py-0.5 flex-1 select-all + ikonka iconSm, etykieta nad chipem"
        sources={['src/components/dialogs/add-sheet-dialog.tsx:81']}
      >
        <div className="space-y-1">
          <Description withIcon={false} size="xs">
            Konto usługi:
          </Description>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded px-1 py-0.5 text-xs break-all select-all">
              {SERVICE_ACCOUNT}
            </code>
            <Button
              type="button"
              size="iconSm"
              variant="outline"
              className="shrink-0"
              aria-label="Kopiuj adres konta usługi"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="chip px-1 py-0.5 select-all w linii z etykietą, bez kopiowania"
        sources={['src/components/dialogs/sheet-setup-dialog.tsx:66']}
      >
        <Description size="xs" withIcon={false}>
          Konto usługi:{' '}
          <code className="bg-muted rounded px-1 py-0.5 text-xs break-all select-all">
            {SERVICE_ACCOUNT}
          </code>
        </Description>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="chip px-2 py-1 bez select-all + przycisk sm „Kopiuj adres”"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-access-block.tsx:31']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-muted rounded px-2 py-1 text-xs break-all">{SERVICE_ACCOUNT}</code>
          <Button size="sm" variant="outline">
            <Copy />
            Kopiuj adres
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="Input readOnly (zaznacza się po focusie) + ikonka outline size icon"
        sources={['src/components/kosztorys/editor/dialogs/share/share-link-panel.tsx:77']}
      >
        <div className="flex w-full gap-2">
          <Input readOnly value="https://wykonczymy.example/z/mieszkanie-kowalskich/abc123" />
          <Button variant="outline" size="icon" aria-label="Kopiuj link">
            <Copy />
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="instrukcja podpięcia arkusza: numerowana lista + „Otwórz wszystkie arkusze ↗”"
        sources={['src/components/dialogs/add-sheet-dialog.tsx:71']}
      >
        <div className="space-y-4 text-sm">
          <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
            <li>
              Stwórz nową kopię <strong>„Kosztorys Wzór&quot;</strong> w Arkuszach Google.
            </li>
            <li>
              Udostępnij arkusz <strong>jako Edytujący</strong> dla konta usługi (poniżej).
            </li>
          </ol>
          <ExternalLink href={SAMPLE_SHEETS_URL}>Otwórz wszystkie arkusze ↗</ExternalLink>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="f"
        label="instrukcja podpięcia arkusza: link „Otwórz arkusze google ↗” + jedno zdanie w Description"
        sources={['src/components/dialogs/sheet-setup-dialog.tsx:57']}
      >
        <section className="space-y-2 text-sm">
          <p>
            <ExternalLink href={SAMPLE_SHEETS_URL}>Otwórz arkusze google ↗</ExternalLink>
          </p>
          <Description size="xs">
            Najpierw udostępnij arkusz <strong>jako Edytujący</strong> dla konta usługi, a następnie
            wklej jego link poniżej.
          </Description>
        </section>
      </AuditVariant>
    </AuditGroup>
  )
}
