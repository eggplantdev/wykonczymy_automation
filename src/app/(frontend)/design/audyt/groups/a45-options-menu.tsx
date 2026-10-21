'use client'

import {
  Download,
  Ellipsis,
  History,
  Printer,
  Redo2,
  Search,
  Settings,
  SheetIcon,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxRow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A45OptionsMenuGroup() {
  return (
    <AuditGroup
      id="A45"
      title="Menu „Opcje”"
      count="4 wystąpienia w 4 plikach · 4 wersje"
      drift={[
        'Wyzwalacz: Button size="lg" z etykietą max-sm:sr-only (raport) vs size="lg" z etykietą zawsze (podgląd) vs size="sm" (edytor) vs size="icon" z Ellipsis i sr-only „Więcej akcji”, tylko poniżej sm (podgląd pliku).',
        'Ikona: Settings w trzech miejscach, Ellipsis w podglądzie pliku.',
        'Treść: DropdownMenuLabel + separatory + MenuItemBody z opisem tylko w edytorze; gdzie indziej płaska lista pozycji.',
        'Szerokość treści: w-80 w edytorze vs domyślna (min-w-[8rem]) wszędzie indziej.',
        'Położenie: ml-auto shrink-0 na przycisku (raport), ml-auto na kontenerze (podgląd), bez marginesu (edytor).',
      ]}
      proposal={
        <>
          <code>OptionsMenu</code> w <code>ui/</code> (props: <code>size</code> =&quot;sm&quot; |
          &quot;lg&quot;, <code>labelHiddenOnMobile?</code>, <code>contentClassName?</code>,{' '}
          <code>children</code>) — jeden wyzwalacz Settings + „Opcje” z{' '}
          <code>align=&quot;end&quot;</code>; wariant ikonowy Ellipsis jako <code>iconOnly</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="raport pracownika — Button lg, ml-auto shrink-0, etykieta max-sm:sr-only; same checkboxy (menu otwarte przez OpenPreview)"
        sources={['src/components/kosztorys/worker-report/report-bar.tsx:33']}
      >
        <OpenPreview backdrop={false} className="h-64 justify-start">
          <div className="border-border flex w-full items-center gap-3 border-b px-4 py-3">
            <div className="relative w-full max-w-md">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value=""
                onChange={() => {}}
                placeholder="Szukaj pracy…"
                className="h-10 pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" variant="outline" className="ml-auto shrink-0">
                  <Settings />
                  <span className="max-sm:sr-only">Opcje</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxRow
                  checked={false}
                  onCheckedChange={() => {}}
                  label="Wszystkie prace (+12)"
                />
                <DropdownMenuCheckboxRow
                  checked
                  onCheckedChange={() => {}}
                  label="Tylko zgłaszane przeze mnie (3)"
                />
                <DropdownMenuCheckboxRow
                  checked={false}
                  onCheckedChange={() => {}}
                  label="Pokaż sumę do tej pory wykonanej pracy"
                />
                <DropdownMenuCheckboxRow checked onCheckedChange={() => {}} label="Pokaż postęp" />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="podgląd kosztorysu dla klienta — Button lg, etykieta zawsze widoczna; bez przełącznika panelu sum obok (komponent funkcji)"
        sources={['src/components/kosztorys/editor/preview-header-actions.tsx:57']}
      >
        <OpenPreview backdrop={false} className="h-48 justify-start">
          <div className="ml-auto flex shrink-0 items-center gap-2 max-sm:order-last max-sm:grid max-sm:w-full max-sm:auto-cols-fr max-sm:grid-flow-col">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" variant="outline">
                  <Settings />
                  Opcje
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <History />
                  Zobacz historię zmian
                </DropdownMenuItem>
                <DropdownMenuCheckboxRow
                  checked={false}
                  onCheckedChange={() => {}}
                  label="Pokaż wszystkie pozycje (+12)"
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="pasek edytora kosztorysu — Button sm, treść w-80 z sekcjami i MenuItemBody; pozycje-komponenty funkcji (Zmień kolejność, Zapisz wersję…) pominięte"
        sources={['src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx:73']}
      >
        <OpenPreview backdrop={false} className="h-120 justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings />
                Opcje
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Edycja</DropdownMenuLabel>
              <DropdownMenuItem>
                <Undo2 />
                <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Redo2 />
                <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
              </DropdownMenuItem>
              <DropdownMenuCheckboxRow
                checked={false}
                onCheckedChange={() => {}}
                label={
                  <MenuItemBody
                    label="Dopasuj wysokość wierszy"
                    description="Każdy wiersz rośnie do swojego opisu, zamiast ucinać go na jednej linii."
                  />
                }
              />
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Wersje</DropdownMenuLabel>
              <DropdownMenuItem>
                <History />
                <MenuItemBody
                  label="Wczytaj"
                  description="Przywróć kosztorys do wcześniej zapisanego stanu."
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Arkusz Google</DropdownMenuLabel>
              <DropdownMenuItem>
                <SheetIcon />
                <MenuItemBody
                  label="Pobierz z arkusza Google…"
                  description="Wczytaj sekcje, prace, stawki i etapy z arkusza podpiętego do tej inwestycji."
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="podgląd pliku — Button size=icon z Ellipsis i sr-only; w źródle sm:hidden (tylko telefon), tu bez sm:hidden, żeby było widać"
        sources={['src/components/media/media-preview-dialog.tsx:302']}
      >
        <OpenPreview backdrop={false} className="h-48 justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="ml-auto">
                <Ellipsis />
                <span className="sr-only">Więcej akcji</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="default">
                <Printer />
                Drukuj
              </DropdownMenuItem>
              <DropdownMenuItem variant="default">
                <Download />
                Pobierz
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive">
                <Trash2 />
                Usuń plik
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </OpenPreview>
      </AuditVariant>
    </AuditGroup>
  )
}
