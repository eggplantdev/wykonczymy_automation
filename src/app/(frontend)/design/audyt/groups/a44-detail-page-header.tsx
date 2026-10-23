'use client'

import Link from 'next/link'
import {
  ArrowRightLeft,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Plus,
  Table2,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BadgeSelect } from '@/components/ui/badge-select'
import { Button } from '@/components/ui/button'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import { SELECT_NONE, SimpleSelect } from '@/components/ui/simple-select'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const STATUS_OPTIONS = [
  { value: 'active', badge: <Badge tone="positive">Aktywna</Badge> },
  { value: 'completed', badge: <Badge tone="muted">Zakończona</Badge> },
] as const

export function A44DetailPageHeaderGroup() {
  return (
    <AuditGroup
      id="A44"
      title="Nagłówek strony szczegółów"
      count="5 wystąpień w 5 plikach · 4 wersje"
      drift={[
        'Położenie akcji: wiersz nad InfoList (kasa, pracownik, inwestycja) vs pod InfoList (sprzęt) vs w kolumnie po prawej, justify-between (flota).',
        'Wiersz akcji: flex flex-wrap gap-2 vs flex flex-wrap items-center gap-2 (inwestycja).',
        'Rozmiar przycisków: RowActionButton/EditButton showLabel (size sm) obok zwykłego Button bez size (kasa „Sprawdź faktury”) i Button size="sm" (flota „Przegląd”).',
        'Status: Badge jako pierwszy wiersz InfoList (sprzęt, flota) vs osobny wiersz z BadgeSelect pod InfoList (inwestycja) vs brak (kasa, pracownik).',
        'Podtytuł: PageWrapper description (sprzęt, flota) vs brak; flota dokłada drugą InfoList layout="stacked".',
      ]}
      proposal={
        <>
          <code>DetailPageHeader</code> w <code>ui/</code> (props: <code>actions</code>,{' '}
          <code>status?</code>, <code>info</code> jako elementy InfoList, <code>aside?</code>) z
          jednym położeniem akcji — nad InfoList, <code>flex flex-wrap items-center gap-2</code>,
          wszystkie przyciski size=&quot;sm&quot;.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="akcje nad InfoList, flex flex-wrap gap-2 (pracownik: przyciski z w-fit, „Zainstaluj aplikację” sm:hidden)"
        sources={[
          'src/app/(frontend)/kasa/[id]/page.tsx:63',
          'src/app/(frontend)/pracownicy/[id]/page.tsx:149',
        ]}
      >
        <PageWrapper title="Kasa Jana Kowalskiego">
          <div className="flex flex-wrap gap-2">
            <EditButton label="Edytuj kasę" showLabel />
            <Button variant="outline">
              <FileSearch />
              Sprawdź faktury
            </Button>
          </div>
          <InfoList items={[{ label: 'Właściciel', value: 'Jan Kowalski' }]} />
          <SignedMoneyDisplay amount={12345.67} />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="akcje nad InfoList z items-center; status jako osobny wiersz BadgeSelect pod InfoList"
        sources={['src/components/investments/investment-overview.tsx:44']}
      >
        <PageWrapper title="Mieszkanie Mokotów">
          <div className="flex flex-wrap items-center gap-2">
            <EditButton label="Edytuj inwestycję" showLabel />
            <RowActionButton icon={FileText} label="Umowa" showLabel />
            <Button size="sm" asChild>
              <Link href="#">
                <FileSpreadsheet />
                Otwórz
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="#">
                <Table2 />
                Kosztorys v2
              </Link>
            </Button>
            <RowActionButton icon={Truck} label="Kontener" showLabel />
          </div>
          <div className="grid gap-2">
            <InfoList
              items={[
                { label: 'Adres', value: 'ul. Puławska 12, 02-566 Warszawa' },
                { label: 'Telefon', value: '600 100 200' },
                { label: 'Osoba kontaktowa', value: 'Anna Nowak' },
                {
                  label: 'Kierownik budowy',
                  value: (
                    <SimpleSelect
                      value="1"
                      onValueChange={() => {}}
                      options={[
                        { value: SELECT_NONE, label: '— brak —' },
                        { value: '1', label: 'Jan Kowalski' },
                      ]}
                      variant="toolbarSm"
                    />
                  ),
                },
              ]}
            />
            <div className="flex min-h-7 items-center">
              <BadgeSelect value="active" options={STATUS_OPTIONS} onValueChange={() => {}} />
            </div>
          </div>
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="description w PageWrapper, status w InfoList, akcje POD InfoList"
        sources={['src/app/(frontend)/sprzet/[id]/page.tsx:73']}
      >
        <PageWrapper title="Wiertarka udarowa" description="Bosch GBH 2-26">
          <InfoList
            items={[
              { label: 'Status', value: <Badge tone="positive">W użyciu</Badge> },
              { label: 'Gdzie jest', value: 'Magazyn Mokotów' },
              { label: 'Inwestycja', value: 'Mieszkanie Mokotów' },
              { label: 'Nr seryjny', value: 'SN-2026-0042' },
              { label: 'Zakup', value: '20.10.2026' },
              { label: 'Cena zakupu', value: '1 111,11 zł' },
              { label: 'Uwagi', value: '' },
            ]}
          />

          <div className="flex flex-wrap gap-2">
            <RowActionButton
              icon={ArrowRightLeft}
              label="Przekaż sprzęt"
              text="Przekaż"
              showLabel
            />
            <EditButton label="Edytuj sprzęt" showLabel />
          </div>
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="description w PageWrapper, dwie InfoList po lewej, akcje po prawej (justify-between)"
        sources={[
          'src/app/(frontend)/flota/[id]/page.tsx:43',
          'src/app/(frontend)/flota/[id]/page.tsx:81',
        ]}
      >
        <PageWrapper title="WX 12345" description="Ford Transit · 2021">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <InfoList
                items={[
                  { label: 'Status', value: <Badge tone="positive">W użyciu</Badge> },
                  { label: 'VIN', value: 'WF0XXXTTGXKA12345' },
                  { label: 'Opony', value: 'Zimowe' },
                  { label: 'Ubezpieczenie', value: 'PZU do 20.10.2027' },
                  { label: 'Uwagi', value: '' },
                ]}
              />
              <InfoList
                layout="stacked"
                items={[
                  {
                    label: 'Od wymiany oleju do ostatniego odczytu przejechano:',
                    value: <span className="flex items-center gap-1.5">8 400 km</span>,
                  },
                  { label: 'Do wymiany:', value: 'Olej' },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <EditButton label="Edytuj pojazd" showLabel />
              <Button variant="outline" size="sm">
                <Plus />
                Przegląd
              </Button>
            </div>
          </div>
        </PageWrapper>
      </AuditVariant>
    </AuditGroup>
  )
}
