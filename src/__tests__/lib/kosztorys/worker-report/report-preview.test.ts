import { describe, expect, it } from 'vitest'
import type { ReportPreviewLineRowT, ReportPreviewReadT } from '@/lib/db/worker-reports'
import { buildReportPreview } from '@/lib/kosztorys/worker-report/report-preview'
import type { ReportStatusT } from '@/lib/kosztorys/worker-report/report-status'

const report = (status: ReportStatusT): ReportPreviewReadT['report'] => ({
  id: 1,
  investmentId: 7,
  investmentName: 'Mokotów',
  workerId: 3,
  workerName: 'Jan Testowy',
  workerLanguage: 'uk',
  status,
  source: 'link',
  createdByName: null,
  sentAt: '2026-10-01T10:00:00.000Z',
  decidedAt: status === 'pending' ? null : '2026-10-02T10:00:00.000Z',
  decidedByName: status === 'pending' ? null : 'Kierownik',
  targetStageId: null,
  targetStageOrdinal: null,
  targetStageLabel: null,
  lineCount: 2,
  acceptedLineCount: 0,
})

const line = (overrides: Partial<ReportPreviewLineRowT>): ReportPreviewLineRowT => ({
  id: 1,
  position: 0,
  kind: 'rozpiska',
  itemId: 10,
  description: 'Malowanie ścian',
  unit: 'm2',
  sectionName: 'Salon',
  reportedQty: 12,
  acceptedQty: null,
  createdItemId: null,
  catalogueItemId: null,
  polishDescription: null,
  descriptionLanguage: null,
  isUncertain: false,
  scannedRef: null,
  ref: 4,
  itemDescription: 'Malowanie ścian',
  descriptionTranslations: {},
  sectionColor: null,
  sectionOrder: 0,
  ...overrides,
})

const build = (
  read: Pick<ReportPreviewReadT, 'report' | 'lines'>,
  viewer: { isManagement: boolean; viewerLanguage?: 'pl' | 'uk' | 'ru' },
) =>
  buildReportPreview(
    { ...read, media: [] },
    {
      viewerLanguage: viewer.viewerLanguage ?? 'pl',
      isManagement: viewer.isManagement,
      sectionTranslations: {},
    },
  )

describe('buildReportPreview — Przyjęto', () => {
  it('shows every line of a pending report as waiting', () => {
    const preview = build(
      { report: report('pending'), lines: [line({ id: 1 }), line({ id: 2, position: 1 })] },
      { isManagement: true },
    )
    expect(preview.lines.map((each) => each.outcome)).toEqual([
      { kind: 'pending' },
      { kind: 'pending' },
    ])
  })

  it('shows every line of a rejected report as rejected', () => {
    const preview = build(
      { report: report('rejected'), lines: [line({ id: 1 }), line({ id: 2, position: 1 })] },
      { isManagement: true },
    )
    expect(preview.lines.map((each) => each.outcome.kind)).toEqual(['rejected', 'rejected'])
  })

  it('splits a partially accepted report into its qty and the rejected rest', () => {
    const preview = build(
      {
        report: report('accepted'),
        lines: [line({ id: 1, acceptedQty: 8 }), line({ id: 2, position: 1, acceptedQty: null })],
      },
      { isManagement: true },
    )
    expect(preview.lines.map((each) => each.outcome)).toEqual([
      { kind: 'accepted', qty: 8 },
      { kind: 'rejected' },
    ])
  })
})

describe('buildReportPreview — opis per viewer', () => {
  const translated = line({
    descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
  })

  it('gives a worker on Ukrainian the pozycja translation', () => {
    const preview = build(
      { report: report('pending'), lines: [translated] },
      { isManagement: false, viewerLanguage: 'uk' },
    )
    expect(preview.lines[0]?.description).toBe('Фарбування стін')
    expect(preview.lines[0]?.workerDescription).toBeUndefined()
  })

  it('falls back to Polish for a worker when the translation is missing', () => {
    const preview = build(
      { report: report('pending'), lines: [line({})] },
      { isManagement: false, viewerLanguage: 'uk' },
    )
    expect(preview.lines[0]?.description).toBe('Malowanie ścian')
  })

  it('gives management the Polish opis beside the worker-language one', () => {
    const preview = build(
      { report: report('pending'), lines: [translated] },
      { isManagement: true, viewerLanguage: 'uk' },
    )
    expect(preview.lines[0]).toMatchObject({
      description: 'Malowanie ścian',
      workerDescription: 'Фарбування стін',
      workerDescriptionLanguage: 'uk',
    })
  })

  it('shows an extra in his own words to him and in Polish to management', () => {
    const extra = line({
      kind: 'extra',
      itemId: null,
      ref: null,
      itemDescription: null,
      description: 'Демонтаж плитки',
      polishDescription: 'Demontaż płytek',
      descriptionLanguage: 'uk',
    })
    const read = { report: report('pending'), lines: [extra] }

    expect(build(read, { isManagement: false, viewerLanguage: 'uk' }).lines[0]?.description).toBe(
      'Демонтаж плитки',
    )
    expect(build(read, { isManagement: true }).lines[0]).toMatchObject({
      description: 'Demontaż płytek',
      workerDescription: 'Демонтаж плитки',
    })
  })

  it('reads a deleted pozycja from the line snapshot', () => {
    const deleted = line({
      itemId: null,
      ref: null,
      itemDescription: null,
      sectionOrder: null,
      description: 'Gruntowanie',
      sectionName: 'Kuchnia',
    })
    const preview = build({ report: report('pending'), lines: [deleted] }, { isManagement: true })
    expect(preview.lines[0]).toMatchObject({
      description: 'Gruntowanie',
      sectionName: 'Kuchnia',
      ref: undefined,
    })
  })
})
