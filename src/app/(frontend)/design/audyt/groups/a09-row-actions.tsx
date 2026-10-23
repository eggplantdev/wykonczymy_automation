'use client'

import Link from 'next/link'
import { FileSpreadsheet, Info, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A09RowActionsGroup() {
  return (
    <AuditGroup
      id="A09"
      title="Akcje w wierszu"
      count="23 wystąpienia w 20 plikach · 12 wersji"
      drift={[
        'kontener akcji: gap-1 w 12 miejscach, gap-2 w 2; justify-end brakuje w 2 tabelach, więc ich przyciski stoją z lewej',
        'przyciski faktury i notatki w tabeli transakcji omijają RowActionButton: kompaktowo ghost size icon + text-muted-foreground zamiast xs + px-1.5, bez podpowiedzi',
        '„Przywróć”: z ikoną RotateCcw przez RowActionButton tylko w Koszu; gdzie indziej sam tekst, xs albo sm, oczekiwanie jako spinner albo tekst „Przywracanie…”',
        'link do kosztorysu v1: etykieta „Otwórz” / „Arkusz” / „Kosztorys v1”, rozmiar xs albo sm, wariant wypełniony albo outline, href składany ręcznie',
      ]}
      proposal={
        <>
          <code>RowActions</code> w <code>ui/row-actions/</code> (props: <code>children</code>,{' '}
          <code>align?: &apos;end&apos; | &apos;start&apos;</code>, stałe <code>gap-1</code>) obok{' '}
          <code>RestoreButton</code> (na bazie <code>RowActionButton</code> z <code>RotateCcw</code>
          ); faktura i notatka przechodzą na <code>RowActionButton</code>, a link v1 dostaje
          bliźniaka <code>OpenKosztorysV1Button</code> (props: <code>investmentId</code>,{' '}
          <code>label?</code>, <code>size?</code>).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="kontener flex items-center justify-end gap-1 (ramka w-64 tylko na stronie audytu)"
        sources={[
          'src/components/tables/cash-registers.tsx:58',
          'src/components/tables/equipment.tsx:103',
          'src/components/tables/fleet.tsx:100',
          'src/components/tables/investments.tsx:325',
          'src/components/tables/leads.tsx:140',
          'src/components/tables/users.tsx:165',
          'src/components/tables/transfers.tsx:287',
          'src/components/work-catalogue/catalogue-row-actions.tsx:31',
          'src/components/trash/trashed-row-actions.tsx:27',
          'src/components/presets/preset-row-actions.tsx:29',
        ]}
      >
        <div className="w-64 border border-dashed">
          <div className="flex items-center justify-end gap-1">
            <EditButton />
            <DeleteButton />
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="kontener justify-end gap-2 (ramka w-64 tylko na stronie audytu)"
        sources={[
          'src/components/tables/telmak-check.tsx:92',
          'src/components/sheets/linked-sheet-actions.tsx:48',
        ]}
      >
        <div className="w-64 border border-dashed">
          <div className="flex items-center justify-end gap-2">
            <EditButton />
            <DeleteButton />
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="kontener gap-1 bez justify-end — akcje z lewej (ramka w-64 tylko na stronie audytu)"
        sources={[
          'src/components/tables/worker-reports.tsx:90',
          'src/components/tables/expense-drafts.tsx:74',
        ]}
      >
        <div className="w-64 border border-dashed">
          <div className="flex items-center gap-1">
            <EditButton />
            <DeleteButton />
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="kompaktowy przycisk faktury / notatki z pominięciem RowActionButton (ghost icon + muted); obok prawdziwy EditButton dla porównania"
        sources={[
          'src/components/transfers/invoice-cell.tsx:70',
          'src/components/transfers/note-popover.tsx:21',
        ]}
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="Dodaj fakturę"
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="Pokaż notatkę"
          >
            <Info />
          </Button>
          <EditButton />
        </div>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="te same przyciski w trybie z etykietami (outline xs + tekst)"
        sources={[
          'src/components/transfers/invoice-cell.tsx:70',
          'src/components/transfers/note-popover.tsx:21',
        ]}
      >
        <div className="flex items-center gap-1">
          <Button variant="outline" size="xs" aria-label="Dodaj fakturę">
            <Plus />
            FV
          </Button>
          <Button variant="outline" size="xs" aria-label="Pokaż notatkę">
            <Info />
            Notatka
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="f"
        label="wysyłanie faktury: ghost icon + muted z pending, bez ikony"
        sources={['src/components/transfers/invoice-cell.tsx:52']}
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          pending
          aria-label="Wysyłanie faktury"
        />
      </AuditVariant>
      <AuditVariant
        letter="g"
        label="„Przywróć” przez RowActionButton showLabel + RotateCcw"
        sources={['src/components/trash/trashed-row-actions.tsx:28']}
      >
        <RowActionButton
          icon={RotateCcw}
          label="Przywróć „Jan Kowalski”"
          text="Przywróć"
          showLabel
        />
      </AuditVariant>
      <AuditVariant
        letter="h"
        label="„Przywróć” outline xs, sam tekst, oczekiwanie jako spinner — spoczynek i pending"
        sources={['src/components/worker-expenses/restore-expense-draft-button.tsx:35']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline">
            Przywróć
          </Button>
          <Button size="xs" variant="outline" pending>
            Przywróć
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="i"
        label="„Przywróć” outline sm, sam tekst, oczekiwanie jako tekst — spoczynek i w trakcie"
        sources={['src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:174']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline">
            Przywróć
          </Button>
          <Button size="sm" variant="outline" disabled>
            Przywracanie…
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="j"
        label="link do kosztorysu v1: wypełniony, rozmiar z propa (domyślnie xs), „Otwórz”"
        sources={['src/components/investments/sheet-button.tsx:15']}
      >
        <Button size="xs" asChild>
          <Link href="#">
            <FileSpreadsheet />
            Otwórz
          </Link>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="k"
        label="link do kosztorysu v1: wypełniony sm, „Arkusz”"
        sources={['src/components/sheets/linked-sheet-actions.tsx:49']}
      >
        <Button size="sm" asChild>
          <Link href="#">
            <FileSpreadsheet />
            Arkusz
          </Link>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="l"
        label="link do kosztorysu v1: outline xs, „Kosztorys v1”"
        sources={['src/components/trash/trashed-investment-links.tsx:14']}
      >
        <Button size="xs" variant="outline" asChild>
          <Link href="#">
            <FileSpreadsheet />
            Kosztorys v1
          </Link>
        </Button>
      </AuditVariant>
    </AuditGroup>
  )
}
