import { Badge, BadgeButton } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A08StatusBadgeGroup() {
  return (
    <AuditGroup
      id="A08"
      title="Badge statusu"
      count="14 wystąpień w 13 plikach · 11 wersji"
      drift={[
        '„Odrzucone” jest czerwone (negative) w wypłatach, inwestycjach i pozycjach wydatku, ale szare (muted) w zgłoszeniach wydatków i raportach pracowników.',
        'Ta sama trójka czeka / przyjęte / odrzucone ma trzy zestawy etykiet: „czeka / przyjęty”, „Do sprawdzenia / Przyjęte”, „Do sprawdzenia / Przyjęty”.',
        'Anulowanie → muted dopisane ręcznie dwa razy (wypłata, zamówienie); w pozostałych mapach nie ma takiej reguły.',
        'Każda mapa tonów to osobny plik z własną nazwą (STATUS_TONES, STATUS_TONE, ROLE_TONES, SOURCE_TONES, AI_PROGRESS_TONES); źródło leadu jest wpisane wprost w kolumnę tabeli.',
        'Przełączany badge: tooltip tylko w zamówieniu (w leadach podpowiedź siedzi w nagłówku kolumny), disabled w trakcie zapisu tylko w zamówieniu, wersja tylko do odczytu (Badge) wszędzie poza leadami.',
      ]}
      proposal={
        <>
          <code>StatusBadge</code> w <code>ui/</code> z propsami <code>tones</code> (mapa status →
          ton), <code>status</code>, <code>label</code> i <code>cancelled?</code> (→ muted).
          Przełączniki jako <code>ToggleBadge</code> (<code>on</code>, <code>onLabel</code>,{' '}
          <code>offLabel</code>, <code>canToggle</code>, <code>pending</code>, <code>tooltip?</code>
          ).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="czeka / przyjęte / odrzucone — odrzucone szare (muted)"
        sources={[
          'src/components/worker-expenses/draft-status-badge.tsx:13',
          'src/components/worker-reports/worker-report-status-badge.tsx:36',
        ]}
      >
        <Badge tone="pending">czeka</Badge>
        <Badge tone="positive">przyjęty</Badge>
        <Badge tone="muted">odrzucony</Badge>
        <Badge tone="pending">Do sprawdzenia</Badge>
        <Badge tone="positive">Przyjęte</Badge>
        <Badge tone="muted">Odrzucone</Badge>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="przełączany aktywny / nieaktywny: BadgeButton gdy wolno, inaczej Badge; bez tooltipa i bez disabled"
        sources={[
          'src/components/tables/cash-registers.tsx:50',
          'src/components/tables/users.tsx:123',
        ]}
      >
        <BadgeButton tone="positive">Aktywna</BadgeButton>
        <BadgeButton tone="muted">Nieaktywna</BadgeButton>
        <Badge tone="positive">Aktywny</Badge>
        <Badge tone="muted">Nieaktywny</Badge>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="status sprzętu: w użyciu zielony, cztery pozostałe szare"
        sources={[
          'src/components/equipment/equipment-status-badge.tsx:4',
          'src/components/fleet/vehicle-status-badge.tsx:4',
        ]}
      >
        <Badge tone="positive">W użyciu</Badge>
        <Badge tone="muted">Wycofany</Badge>
        <Badge tone="muted">Sprzedany</Badge>
        <Badge tone="muted">Zgubiony</Badge>
        <Badge tone="muted">Skradziony</Badge>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="wypłata: odrzucona czerwona (negative), anulowana → muted"
        sources={['src/components/receipt-confirmation/payout-status-badge.tsx:15']}
      >
        <Badge tone="pending">Czeka na potwierdzenie</Badge>
        <Badge tone="positive">Potwierdzona</Badge>
        <Badge tone="negative">Odrzucona</Badge>
        <Badge tone="muted">Anulowana</Badge>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="pozycja wydatku: wspólna mapa DECISION_TONE z ui/, odrzucony czerwony, etykiety lokalne"
        sources={['src/components/forms/expense-form/collapsible-line-item.tsx:49']}
      >
        <Badge tone="pending" className="shrink-0">
          Do sprawdzenia
        </Badge>
        <Badge tone="positive" className="shrink-0">
          Przyjęty
        </Badge>
        <Badge tone="negative" className="shrink-0">
          Odrzucony
        </Badge>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="status inwestycji (5 tonów, odrzucona czerwona)"
        sources={['src/components/investments/investment-status-badge.tsx:4']}
      >
        <Badge tone="sky">Planowana</Badge>
        <Badge tone="pending">Wycena</Badge>
        <Badge tone="positive">Aktywna</Badge>
        <Badge tone="muted">Zakończona</Badge>
        <Badge tone="negative">Odrzucona</Badge>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="status zamówienia: anulowane → muted; gdy wolno, BadgeButton w SimpleTooltip z disabled w trakcie zapisu"
        sources={['src/components/orders/order-status-badge.tsx:12']}
      >
        <Badge tone="pending">Czeka</Badge>
        <Badge tone="positive">Dostarczone</Badge>
        <Badge tone="muted">Czeka</Badge>
        <SimpleTooltip content="Zmień status zamówienia">
          <BadgeButton tone="pending">Czeka</BadgeButton>
        </SimpleTooltip>
        <SimpleTooltip content="Zmień status zamówienia">
          <BadgeButton tone="positive" disabled>
            Dostarczone
          </BadgeButton>
        </SimpleTooltip>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="postęp AI inwestycji (6 tonów: muted, pending, cyan, violet, positive, orange)"
        sources={['src/components/investments/ai-progress-badge.tsx:4']}
      >
        <Badge tone="muted">Uzupełnianie informacji</Badge>
        <Badge tone="pending">Gotowa do analizy</Badge>
        <Badge tone="cyan">Przeanalizowana</Badge>
        <Badge tone="violet">Recenzja zakończona</Badge>
        <Badge tone="positive">Wiedza wyekstraktowana</Badge>
        <Badge tone="orange">Nowe informacje</Badge>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="rola konta (etykieta podawana z zewnątrz, nie z mapy)"
        sources={['src/components/users/role-badge.tsx:4']}
      >
        <Badge tone="pending">Admin</Badge>
        <Badge tone="violet">Właściciel</Badge>
        <Badge tone="sky">Manager</Badge>
        <Badge tone="positive">Pracownik</Badge>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="źródło leadu — mapa wpisana wprost w kolumnę tabeli"
        sources={['src/components/tables/leads.tsx:20']}
      >
        <Badge tone="sky">Facebook</Badge>
        <Badge tone="positive">Strona WWW</Badge>
        <Badge tone="violet">Landing</Badge>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="status kontaktu leadu: zawsze BadgeButton, bez wersji tylko do odczytu, tooltip w nagłówku kolumny"
        sources={['src/components/tables/leads.tsx:108']}
      >
        <BadgeButton tone="positive">Skontaktowano</BadgeButton>
        <BadgeButton tone="muted">Oczekuje</BadgeButton>
      </AuditVariant>
    </AuditGroup>
  )
}
