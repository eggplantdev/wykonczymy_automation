import { requireManagementPage } from '@/lib/auth/require-management-page'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { Description } from '@/components/ui/description'
import { TextLink } from '@/components/ui/text-link'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { A03SectionHeadingGroup } from './groups/a03-section-heading'
import { A04TwoLineValueGroup } from './groups/a04-two-line-value'
import { A05AddButtonGroup } from './groups/a05-add-button'
import { A06AiButtonGroup } from './groups/a06-ai-button'
import { A07StatusTextGroup } from './groups/a07-status-text'
import { A08StatusBadgeGroup } from './groups/a08-status-badge'
import { A09RowActionsGroup } from './groups/a09-row-actions'
import { A10StripBannerGroup } from './groups/a10-strip-banner'
import { A11TotalRowGroup } from './groups/a11-total-row'
import { A12EmptyListGroup } from './groups/a12-empty-list'
import { A13PageShellGroup } from './groups/a13-page-shell'
import { A14FormActionsGroup } from './groups/a14-form-actions'
import { A15ResponsiveIconButtonGroup } from './groups/a15-responsive-icon-button'
import { A16WorkItemLabelGroup } from './groups/a16-work-item-label'
import { A17CaptionHintGroup } from './groups/a17-caption-hint'
import { A18ListRowOptionGroup } from './groups/a18-list-row-option'
import { A19NameDialogGroup } from './groups/a19-name-dialog'
import { A21MoneyCardGroup } from './groups/a21-money-card'
import { A22ValueChangeGroup } from './groups/a22-value-change'
import { A23DecisionStampGroup } from './groups/a23-decision-stamp'
import { A24CountTextGroup } from './groups/a24-count-text'
import { A25LabelValueListGroup } from './groups/a25-label-value-list'
import { A26CopyableCodeGroup } from './groups/a26-copyable-code'
import { A27RepeatableRowsGroup } from './groups/a27-repeatable-rows'
import { A28TruncatedTextGroup } from './groups/a28-truncated-text'
import { A29OverlaySurfaceGroup } from './groups/a29-overlay-surface'
import { A30InlineFieldsGroup } from './groups/a30-inline-fields'
import { A31TableCallSiteGroup } from './groups/a31-table-call-site'
import { A32TableColumnsGroup } from './groups/a32-table-columns'
import { A33ReviewFlowsGroup } from './groups/a33-review-flows'
import { A34DialogShellGroup } from './groups/a34-dialog-shell'
import { A35SummaryPanelsGroup } from './groups/a35-summary-panels'
import { A36FilterBarGroup } from './groups/a36-filter-bar'
import { A37ViewSwitchGroup } from './groups/a37-view-switch'
import { A38UploadZoneGroup } from './groups/a38-upload-zone'
import { A39DeleteConfirmGroup } from './groups/a39-delete-confirm'
import { A40SearchInputGroup } from './groups/a40-search-input'
import { A41ListPageHeaderGroup } from './groups/a41-list-page-header'
import { A42DetailSectionsGroup } from './groups/a42-detail-sections'
import { A43ManualCollapsibleGroup } from './groups/a43-manual-collapsible'
import { A44DetailPageHeaderGroup } from './groups/a44-detail-page-header'
import { A45OptionsMenuGroup } from './groups/a45-options-menu'
import { A46EntityPickerGroup } from './groups/a46-entity-picker'

type TocEntryT = { id: string; label: string }

const GROUPS: (TocEntryT & { Group: () => React.ReactNode; children?: TocEntryT[] })[] = [
  { id: 'A03', label: 'Nagłówek sekcji', Group: A03SectionHeadingGroup },
  { id: 'A04', label: 'Wartość z podpisem pod spodem', Group: A04TwoLineValueGroup },
  { id: 'A05', label: 'Przycisk „Dodaj”', Group: A05AddButtonGroup },
  { id: 'A06', label: 'Przycisk AI', Group: A06AiButtonGroup },
  { id: 'A07', label: 'Kolorowy tekst statusu', Group: A07StatusTextGroup },
  { id: 'A08', label: 'Badge statusu', Group: A08StatusBadgeGroup },
  { id: 'A09', label: 'Akcje w wierszu', Group: A09RowActionsGroup },
  { id: 'A10', label: 'Pasek pod nagłówkiem', Group: A10StripBannerGroup },
  { id: 'A11', label: 'Wiersz sumy', Group: A11TotalRowGroup },
  { id: 'A12', label: 'Komunikat pustej listy', Group: A12EmptyListGroup },
  { id: 'A13', label: 'Powłoka stron publicznych i logowania', Group: A13PageShellGroup },
  { id: 'A14', label: 'Przyciski formularza i stopka', Group: A14FormActionsGroup },
  {
    id: 'A15',
    label: 'Przycisk z etykietą chowaną na telefonie',
    Group: A15ResponsiveIconButtonGroup,
  },
  { id: 'A16', label: 'Etykieta pozycji kosztorysu', Group: A16WorkItemLabelGroup },
  { id: 'A17', label: 'Podpis, opis i podpowiedź', Group: A17CaptionHintGroup },
  { id: 'A18', label: 'Wiersz wyboru na liście', Group: A18ListRowOptionGroup },
  { id: 'A19', label: 'Dialog z jednym polem nazwy', Group: A19NameDialogGroup },
  { id: 'A21', label: 'Karta kwoty na telefonie', Group: A21MoneyCardGroup },
  { id: 'A22', label: 'Zmiana wartości przed → po', Group: A22ValueChangeGroup },
  { id: 'A23', label: 'Kto i kiedy zdecydował', Group: A23DecisionStampGroup },
  { id: 'A24', label: 'Licznik w tekście', Group: A24CountTextGroup },
  { id: 'A25', label: 'Lista etykieta–wartość', Group: A25LabelValueListGroup },
  { id: 'A26', label: 'Adres do skopiowania', Group: A26CopyableCodeGroup },
  { id: 'A27', label: 'Lista powtarzalnych wierszy', Group: A27RepeatableRowsGroup },
  { id: 'A28', label: 'Ucięty tekst z podpowiedzią', Group: A28TruncatedTextGroup },
  { id: 'A29', label: 'Kontrolki nad zdjęciem', Group: A29OverlaySurfaceGroup },
  { id: 'A30', label: 'Pola wbudowane', Group: A30InlineFieldsGroup },
  { id: 'A31', label: 'Tabela — oprawa wokół DataTable', Group: A31TableCallSiteGroup },
  { id: 'A32', label: 'Tabela — powtarzane definicje kolumn', Group: A32TableColumnsGroup },
  {
    id: 'A33',
    label: 'Przegląd i akceptacja zgłoszeń',
    Group: A33ReviewFlowsGroup,
    children: [
      { id: 'A33.1', label: 'Nagłówek i liczniki' },
      { id: 'A33.2', label: 'Przycisk akceptacji' },
      { id: 'A33.3', label: 'Odrzucenie i powód' },
      { id: 'A33.4', label: 'Akcje zbiorcze' },
      { id: 'A33.5', label: 'Tabela / lista pozycji' },
      { id: 'A33.6', label: 'Akcje w wierszu' },
      { id: 'A33.7', label: 'Status' },
      { id: 'A33.8', label: 'Pusty stan' },
      { id: 'A33.9', label: 'Potwierdzenia i komunikaty' },
      { id: 'A33.10', label: 'Przebieg' },
      { id: 'A33.11', label: 'Filtrowanie i wyszukiwanie' },
      { id: 'A33.12', label: 'Cofnięcie decyzji' },
    ],
  },
  { id: 'A34', label: 'Oprawa dialogu', Group: A34DialogShellGroup },
  { id: 'A35', label: 'Panele podsumowań', Group: A35SummaryPanelsGroup },
  { id: 'A36', label: 'Pasek filtrów listy', Group: A36FilterBarGroup },
  { id: 'A37', label: 'Przełącznik widoku / trybu', Group: A37ViewSwitchGroup },
  { id: 'A38', label: 'Strefa uploadu plików', Group: A38UploadZoneGroup },
  { id: 'A39', label: 'Potwierdzenie usunięcia / kosz', Group: A39DeleteConfirmGroup },
  { id: 'A40', label: 'Wyszukiwarka', Group: A40SearchInputGroup },
  { id: 'A41', label: 'Nagłówek strony listy', Group: A41ListPageHeaderGroup },
  { id: 'A42', label: 'Sekcje strony szczegółów', Group: A42DetailSectionsGroup },
  { id: 'A43', label: 'Ręcznie zwijany wiersz', Group: A43ManualCollapsibleGroup },
  { id: 'A44', label: 'Nagłówek strony szczegółów', Group: A44DetailPageHeaderGroup },
  { id: 'A45', label: 'Menu „Opcje”', Group: A45OptionsMenuGroup },
  {
    id: 'A46',
    label: 'Wybór inwestycji/pracownika poza formularzem',
    Group: A46EntityPickerGroup,
  },
]

function TocLink({ id, label }: TocEntryT) {
  return (
    <TextLink asChild>
      <a href={`#${id}`}>
        <span className="text-muted-foreground tabular-nums">{id}</span> {label}
      </a>
    </TextLink>
  )
}

export default async function DesignAuditPage() {
  await requireManagementPage()

  return (
    <PageWrapper title="Audyt powtórzonych elementów">
      <Description>
        Każda grupa to element pisany ręcznie w wielu miejscach. Litery a, b, c… to różne wersje
        tego samego elementu — kopie 1:1 z kodu, z listą miejsc. Decyzja per grupa, np. „A03:
        wszędzie b”, „A05: jeden komponent, a + c jako warianty”, „A23: zostaw”. Zostały tylko
        różnice do decyzji — wszystko, co dało się scalić bez zmiany wyglądu i działania, jest już
        scalone.
      </Description>
      <CollapsibleSection title="Spis treści" defaultOpen={false} storageKey="design-audit:toc">
        <nav>
          <ol className="gap-x-6 pt-2 text-sm sm:columns-2 lg:columns-3">
            {GROUPS.map(({ id, label, children }) => (
              <li key={id} className="break-inside-avoid py-0.5">
                <TocLink id={id} label={label} />
                {children && (
                  <ol className="border-border mt-1 ml-1 border-l pl-3">
                    {children.map((child) => (
                      <li key={child.id} className="py-0.5">
                        <TocLink id={child.id} label={child.label} />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </CollapsibleSection>
      <div className="flex flex-col">
        {GROUPS.map(({ id, Group }) => (
          <Group key={id} />
        ))}
      </div>
    </PageWrapper>
  )
}
