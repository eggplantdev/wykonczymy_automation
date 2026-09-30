'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import {
  acceptedQty,
  exactItemMatch,
  isLineReady,
  lineGroup,
  qtyInputText,
  type ItemFiguresT,
  type LineDraftT,
  type LineGroupT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import {
  ReviewLinesTable,
  type ReviewRowT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/review-lines-table'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'
import {
  closestEntries,
  hintCandidates,
} from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import type {
  AcceptReportInputT,
  AcceptTargetT,
  ReportLineT,
  WorkerReportT,
} from '@/lib/kosztorys/worker-report/types'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { pluralize } from '@/lib/utils/polish-plural'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  report: WorkerReportT
  onBack: () => void
  onDecided: () => void
}

const POZYCJA_FORMS = ['pozycję', 'pozycje', 'pozycji'] as const
const NEW_STAGE = 'new'

const GROUPS: { group: LineGroupT; title: string; hint: string }[] = [
  { group: 'rozpiska', title: 'Z rozpiski', hint: 'Przyjęta ilość dodaje się do wybranego etapu.' },
  {
    group: 'extra',
    title: 'Spoza rozpiski',
    hint: 'Pracownik podał tylko opis, j.m. i ilość. Po przyjęciu trafią do rozpiski jako nowe pozycje bez przedmiaru — uzupełnij sekcję i cenę albo podmień na pracę z katalogu.',
  },
]

export function WorkerReportReview({ report, onBack, onDecided }: PropsT) {
  const { rows, stages, sections, workCatalogue, acceptReport, rejectReport } =
    useKosztorysEditorContext()
  const catalogue = workCatalogue ?? []
  const isReadOnly = report.status !== 'pending'
  const liveItemIds = new Set(rows.map((row) => row.id))
  const [drafts, setDrafts] = useState(() => initialDrafts(report, rows, liveItemIds))
  // Only his own etapy: an addition to someone else's would pay that crew for his work.
  const ownStages = stages
    .filter((stage) => stage.split?.members.some((member) => member.workerId === report.workerId))
    .toSorted((first, second) => first.ordinal - second.ordinal)
  const scope = resolveWorkerScope(stages, report.workerId)
  // The latest of his etapy is the one work usually continues.
  const [target, setTarget] = useState(() => String(ownStages.at(-1)?.id ?? NEW_STAGE))
  const [plane, setPlane] = useState<ToolPlaneT | undefined>()
  const [isPending, setIsPending] = useState(false)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const targetStageId = target === NEW_STAGE ? undefined : Number(target)

  const itemIdOf = (line: ReportLineT): number | undefined =>
    line.itemId !== undefined && liveItemIds.has(line.itemId) ? line.itemId : drafts[line.id].itemId
  const figuresOf = (row: KosztorysV2RowT | undefined): ItemFiguresT | undefined => {
    if (!row) return undefined
    return {
      stageQty: targetStageId === undefined ? 0 : (row[stageKey(targetStageId)] ?? 0),
      measuredQty: stages.reduce((sum, stage) => sum + (row[stageKey(stage.id)] ?? 0), 0),
      plannedQty: row.plannedQty,
    }
  }
  const sectionOrder = new Map(sections.map((section, index) => [section.sectionName, index]))
  const reviewRows: ReviewRowT[] = report.lines
    .map((line) => {
      const itemId = line.kind === 'rozpiska' ? itemIdOf(line) : line.createdItemId
      const row = rows.find((candidate) => candidate.id === itemId)
      const sectionName = row?.sectionName ?? line.sectionName ?? ''
      return {
        ...line,
        sectionName,
        sectionColor: row?.sectionColor ?? null,
        sectionOrder: sectionOrder.get(sectionName) ?? sections.length,
        figures: line.kind === 'rozpiska' ? figuresOf(row) : undefined,
        isUnassigned:
          line.kind === 'rozpiska' && (line.itemId === undefined || !liveItemIds.has(line.itemId)),
      }
    })
    .toSorted((first, second) => first.sectionOrder - second.sectionOrder)
  // Scored once per dopisana praca, not per render of a cell: dice over the whole cennik is the
  // expensive part of „Porównaj z katalogiem" too.
  const candidates = hintCandidates(catalogue)
  const hintsByLine = Object.fromEntries(
    report.lines
      .filter((line) => lineGroup(line, drafts[line.id]) === 'extra')
      .map((line) => [line.id, closestEntries(line.description, candidates)]),
  )
  const catalogueOptions = catalogue.map((entry) => ({
    value: String(entry.id),
    label: `${entry.description} (${entry.unit})`,
  }))
  const itemOptions = rows.map((row) => ({
    value: String(row.id),
    label: `${row.description ?? ''} (${row.unit ?? ''}) · ${row.sectionName}`,
  }))
  const targetOptions = [
    ...ownStages.map((stage, index) => ({
      value: String(stage.id),
      label: `${stageLabel(stage)}${index === ownStages.length - 1 ? ' (ostatni)' : ''}`,
    })),
    { value: NEW_STAGE, label: 'Nowy etap' },
  ]
  const planeOptions = TOOL_PLANES.map((value) => ({ value, label: PLANE_LABELS[value] }))
  const sectionOptions = sections.map((section) => ({
    value: String(section.sectionId),
    label: section.sectionName,
  }))

  const needsPlane = targetStageId === undefined && scope.kind === 'blocked'
  const targetProblem =
    needsPlane && scope.reason !== 'no-stages'
      ? 'Rozliczenie etapów tego pracownika nie jest ustalone — wybierz jeden z jego etapów.'
      : undefined
  const tickedLines = report.lines.filter((line) => drafts[line.id].isTicked)
  const isReady =
    targetProblem === undefined &&
    (!needsPlane || scope.reason !== 'no-stages' || plane !== undefined) &&
    report.lines.every((line) =>
      isLineReady(line, drafts[line.id], line.kind === 'rozpiska' ? itemIdOf(line) : undefined),
    )

  const decide = async (run: () => Promise<boolean>, doneMessage: string) => {
    setIsPending(true)
    const isDone = await run()
    setIsPending(false)
    if (!isDone) return
    toastMessage(doneMessage)
    onDecided()
  }

  const accept = () => {
    const acceptTarget: AcceptTargetT =
      targetStageId === undefined
        ? { kind: 'new', plane }
        : { kind: 'stage', stageId: targetStageId }
    const input: AcceptReportInputT = {
      investmentId: report.investmentId,
      reportId: report.id,
      target: acceptTarget,
      lines: [],
      extras: [],
    }
    const touchedItemIds: number[] = []
    for (const line of tickedLines) {
      const draft = drafts[line.id]
      if (lineGroup(line, draft) === 'rozpiska') {
        const itemId = itemIdOf(line) as number
        touchedItemIds.push(itemId)
        input.lines.push({
          lineId: line.id,
          acceptedQty: acceptedQty(draft),
          itemId: itemId === line.itemId ? undefined : itemId,
        })
        continue
      }
      const price = parseDecimalInput(draft.unitPrice)
      input.extras.push({
        lineId: line.id,
        acceptedQty: acceptedQty(draft),
        sectionId: Number(draft.sectionId),
        clientPrice:
          draft.catalogueId === undefined && price.kind === 'value' ? price.value : undefined,
        catalogueItemId: draft.catalogueId,
      })
    }
    void decide(() => acceptReport(input, touchedItemIds), 'Zgłoszenie przyjęte do rozpiski')
  }

  return (
    <div className="worker-report flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{report.workerName}</h3>
          <p className="text-muted-foreground text-xs">
            Wysłano {formatPLDateTime(report.sentAt)}
            {report.decidedAt &&
              ` · sprawdzono ${formatPLDateTime(report.decidedAt)}${report.decidedBy ? ` (${report.decidedBy})` : ''}`}
          </p>
        </div>
        {isReadOnly ? (
          report.target && (
            <p className="text-sm">
              Dodano do:{' '}
              <span className="font-medium">
                {stageLabel({ ordinal: report.target.ordinal, label: report.target.label ?? null })}
              </span>
            </p>
          )
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Label className="gap-2 text-sm font-normal">
              Dodaj do
              <SimpleSelect
                value={target}
                onValueChange={setTarget}
                options={targetOptions}
                className="w-56"
              />
            </Label>
            {needsPlane && scope.reason === 'no-stages' && (
              <Label className="gap-2 text-sm font-normal">
                Rozliczenie
                <SimpleSelect
                  value={plane ?? ''}
                  onValueChange={(value) => setPlane(value as ToolPlaneT)}
                  options={planeOptions}
                  placeholder="Wybierz"
                  className="w-44"
                />
              </Label>
            )}
          </div>
        )}
      </div>
      {targetProblem && <p className="text-destructive text-sm">{targetProblem}</p>}

      <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
        {GROUPS.map(({ group, title, hint }) => {
          const lines = reviewRows.filter((row) => lineGroup(row, drafts[row.id]) === group)
          if (lines.length === 0) return null
          return (
            <section key={group}>
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {title} ({lines.length})
              </h4>
              <p className="text-muted-foreground mb-2 text-xs">{hint}</p>
              <ReviewLinesTable
                group={group}
                rows={lines}
                drafts={drafts}
                onChange={(lineId, patch) =>
                  setDrafts((current) => ({
                    ...current,
                    [lineId]: { ...current[lineId], ...patch },
                  }))
                }
                sectionOptions={sectionOptions}
                itemOptions={itemOptions}
                catalogue={catalogue}
                catalogueOptions={catalogueOptions}
                hintsByLine={hintsByLine}
                isReadOnly={isReadOnly}
              />
            </section>
          )
        })}
      </div>

      {isReadOnly ? (
        <DialogFooter>
          <p className="text-muted-foreground mr-auto self-center text-sm">
            {report.status === 'rejected'
              ? 'Zgłoszenie odrzucone w całości.'
              : `Przyjęto ${report.acceptedLineCount} z ${report.lineCount}.`}
          </p>
          <Button variant="outline" onClick={onBack}>
            Wszystkie zgłoszenia
          </Button>
        </DialogFooter>
      ) : (
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-destructive mr-auto"
            disabled={isPending}
            onClick={() => setIsRejectOpen(true)}
          >
            Odrzuć zgłoszenie
          </Button>
          <Button variant="outline" onClick={onBack}>
            Wszystkie zgłoszenia
          </Button>
          <Button disabled={isPending || tickedLines.length === 0 || !isReady} onClick={accept}>
            Przyjmij {tickedLines.length} {pluralize(tickedLines.length, POZYCJA_FORMS)}
          </Button>
        </DialogFooter>
      )}

      <ConfirmDialog
        open={isRejectOpen}
        title="Odrzucić całe zgłoszenie?"
        description="Nic nie trafi do rozpiski. Zgłoszenie zostanie w historii jako odrzucone."
        confirmLabel="Odrzuć"
        onConfirm={() => {
          setIsRejectOpen(false)
          void decide(() => rejectReport(report.id), 'Zgłoszenie odrzucone')
        }}
        onCancel={() => setIsRejectOpen(false)}
      />
    </div>
  )
}

function initialDrafts(
  report: WorkerReportT,
  rows: KosztorysV2RowT[],
  liveItemIds: ReadonlySet<number>,
): Record<number, LineDraftT> {
  const sectionOfItem = new Map(rows.map((row) => [row.id, String(row.sectionId)]))
  return Object.fromEntries(
    report.lines.map((line) => {
      const isGone =
        line.kind === 'rozpiska' && (line.itemId === undefined || !liveItemIds.has(line.itemId))
      const draft: LineDraftT = {
        isTicked: line.acceptedQty !== undefined,
        qty: qtyInputText(line.acceptedQty ?? line.reportedQty),
        itemId: isGone && report.status === 'pending' ? exactItemMatch(line, rows) : undefined,
        isExtra: line.kind === 'rozpiska' && line.createdItemId !== undefined,
        sectionId:
          line.createdItemId === undefined ? '' : (sectionOfItem.get(line.createdItemId) ?? ''),
        unitPrice: '',
        catalogueId: line.catalogueItemId,
      }
      return [line.id, draft]
    }),
  )
}
