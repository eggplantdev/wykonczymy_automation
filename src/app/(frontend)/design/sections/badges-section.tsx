'use client'

import { useState } from 'react'
import { Badge, BadgeButton, BADGE_TONES, type BadgeToneT } from '@/components/ui/badge'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { CardChip } from '@/components/transfers/cards/card-chip'
import { TransferTypeBadge } from '@/components/transfers/transfer-type-badge'
import { DotBadge } from '@/components/ui/dot-badge'
import { BadgeSelect } from '@/components/ui/badge-select'
import { COLOR_TOKENS } from '@/styles/color-tokens'
import { SectionPill } from '@/components/worker-reports/section-pill'
import { PayoutStatusBadge } from '@/components/receipt-confirmation/payout-status-badge'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import { AiProgressBadge } from '@/components/investments/ai-progress-badge'
import { RoleBadge } from '@/components/users/role-badge'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge'
import { AlertBadge } from '@/components/fleet/alert-badge'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import { useTranslation } from '@/hooks/use-translation'
import { ROLES } from '@/lib/auth/roles'
import { INVESTMENT_STATUSES } from '@/lib/constants/investment-status'
import { AI_PROGRESS_STEPS } from '@/lib/constants/investment-ai-stage'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import { VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'
import { EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'
import type { TransferRowT } from '@/types/transfers'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const TONES = Object.keys(BADGE_TONES) as BadgeToneT[]
const DECISIONS = ['pending', 'accepted', 'rejected'] as const

export function BadgesSection() {
  const transfersTranslator = useTranslation('transfers')
  const [selectedTone, setSelectedTone] = useState<BadgeToneT>(TONES[0])

  return (
    <ShowcaseSection id="badges">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">
        A. Rodzina Badge (ui/badge.tsx)
      </h3>
      <ShowcaseRow title="Badge — wszystkie tony" source="<Badge tone>">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Badge — obrys" source='<Badge appearance="outline">'>
        <Badge appearance="outline">outline</Badge>
      </ShowcaseRow>
      <ShowcaseRow title="Badge — pełny" source='<Badge appearance="solid">'>
        <Badge appearance="solid">solid</Badge>
      </ShowcaseRow>
      <ShowcaseRow title="Badge — pigułka z akcją" source='<Badge shape="pill" onRemove>'>
        <Badge
          appearance="outline"
          shape="pill"
          onRemove={() => {}}
          removeLabel="Usuń"
        >
          Filtr
        </Badge>
        <Badge tone="section" shape="pill">
          Łazienka
        </Badge>
      </ShowcaseRow>
      <ShowcaseRow title="DotBadge — cała paleta" source="ui/dot-badge.tsx">
        {COLOR_TOKENS.map((color) => (
          <DotBadge key={color} color={color}>
            {color}
          </DotBadge>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="PayoutStatusBadge" source="receipt-confirmation/payout-status-badge.tsx">
        {DECISIONS.map((status) => (
          <PayoutStatusBadge
            key={status}
            status={status}
            cancelled={false}
            translator={transfersTranslator}
          />
        ))}
        <PayoutStatusBadge status="rejected" cancelled translator={transfersTranslator} />
      </ShowcaseRow>
      <ShowcaseRow title="InvestmentStatusBadge" source="investments/investment-status-badge.tsx">
        {INVESTMENT_STATUSES.map((status) => (
          <InvestmentStatusBadge key={status} status={status} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="AiProgressBadge" source="investments/ai-progress-badge.tsx">
        {AI_PROGRESS_STEPS.map((step) => (
          <AiProgressBadge key={step} step={step} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="RoleBadge" source="users/role-badge.tsx">
        {ROLES.map((role) => (
          <RoleBadge key={role} role={role}>
            {role}
          </RoleBadge>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Vehicle / Equipment status"
        source="fleet/vehicle-status-badge.tsx, equipment/…"
      >
        {VEHICLE_STATUSES.map((status) => (
          <VehicleStatusBadge key={status} status={status} />
        ))}
        {EQUIPMENT_STATUSES.map((status) => (
          <EquipmentStatusBadge key={status} status={status} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="AlertBadge" source="fleet/alert-badge.tsx">
        <AlertBadge title="alert">Przegląd za 3 dni</AlertBadge>
      </ShowcaseRow>
      <ShowcaseRow
        title="DraftStatusBadge / WorkerReportStatusBadge"
        source="worker-expenses/…, worker-reports/…"
      >
        {DECISIONS.map((status) => (
          <DraftStatusBadge key={status} status={status} />
        ))}
        {DECISIONS.map((status) => (
          <WorkerReportStatusBadge
            key={status}
            status={status}
            lineCount={0}
            acceptedLineCount={0}
            rejectedLineCount={0}
          />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="DecisionProgressBadge" source="ui/decision-progress-badge.tsx">
        <DecisionProgressBadge accepted={3} rejected={1} pending={2} />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Poza Badge — osobny kod
      </h3>
      <ShowcaseRow title="CardChip (obrys, label: wartość)" source="transfers/cards/card-chip.tsx">
        <CardChip kind="register" label="Kasa">
          Główna
        </CardChip>
        <CardChip kind="worker" label="Pracownik">
          Jan
        </CardChip>
        <CardChip kind="category" label="Kategoria">
          Materiały
        </CardChip>
        <CardChip kind="paymentMethod" label="Płatność">
          Gotówka
        </CardChip>
        <CardChip kind="createdBy" label="Dodał">
          Admin
        </CardChip>
      </ShowcaseRow>
      <ShowcaseRow
        title="TransferTypeBadge (wrapper na DotBadge)"
        source="transfers/transfer-type-badge.tsx"
      >
        {TRANSFER_TYPES.map((type) => (
          <TransferTypeBadge
            key={type}
            transfer={{ type, settled: false } as TransferRowT}
            translator={transfersTranslator}
          />
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="SectionPill (kolor z --section-rail)"
        source="worker-reports/section-pill.tsx"
      >
        {(['blue', 'green', 'purple'] as const).map((color) => (
          <span key={color} className={cn('worker-report', sectionColorRail(color))}>
            <SectionPill name="Łazienka" />
          </span>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="BadgeButton (klikalny badge)" source="ui/badge.tsx">
        <BadgeButton tone="positive">Aktywny</BadgeButton>
        <BadgeButton tone="muted">Nieaktywny</BadgeButton>
      </ShowcaseRow>
      <ShowcaseRow title="BadgeSelect (select z badge jako triggerem)" source="ui/badge-select.tsx">
        <BadgeSelect
          value={selectedTone}
          onValueChange={setSelectedTone}
          options={TONES.map((tone) => ({ value: tone, badge: <Badge tone={tone}>{tone}</Badge> }))}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Licznik (pełna pigułka)"
        source='<Badge appearance="solid" shape="pill">'
      >
        {[1, 12, 120].map((count) => (
          <Badge
            key={count}
            appearance="solid"
            shape="pill"
            className="h-5 min-w-5 justify-center tabular-nums"
          >
            {count > 99 ? '99+' : count}
          </Badge>
        ))}
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
