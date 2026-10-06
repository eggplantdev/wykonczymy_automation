import type { ReportPreviewLineRowT, ReportPreviewReadT } from '@/lib/db/worker-reports'
import { translationText, type DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import { isTranslationLanguage, type LanguageT } from '@/lib/i18n/languages'
import {
  renderSectionName,
  sectionNameKey,
  type SectionTranslationMapT,
} from '@/lib/i18n/section-translations'
import { translateUnit } from '@/lib/kosztorys/worker-view/translate-unit'
import type {
  ReportLineOutcomeT,
  ReportPreviewLineT,
  ReportPreviewT,
} from '@/lib/kosztorys/worker-report/types'
import type { ReportStatusT } from '@/lib/kosztorys/worker-report/report-status'

type WorkerDescriptionT = {
  workerDescription: string | undefined
  workerDescriptionLanguage: string | undefined
}

/**
 * The opis as the worker reads it, for a manager to see beside the Polish: an extra he wrote
 * himself in his own words, otherwise the pozycja's translation into his language.
 */
export function workerDescriptionOf(
  line: {
    description: string
    polishDescription: string | undefined
    descriptionLanguage: string | undefined
  },
  translations: DescriptionTranslationsT | undefined,
  workerLanguage: LanguageT | undefined,
): WorkerDescriptionT {
  if (line.polishDescription !== undefined) {
    return {
      workerDescription: line.description,
      workerDescriptionLanguage: line.descriptionLanguage,
    }
  }
  const translated = isTranslationLanguage(workerLanguage)
    ? translationText(translations, workerLanguage)
    : ''
  return {
    workerDescription: translated || undefined,
    workerDescriptionLanguage: translated ? workerLanguage : undefined,
  }
}

function outcomeOf(line: ReportPreviewLineRowT, status: ReportStatusT): ReportLineOutcomeT {
  if (line.acceptedQty !== null) return { kind: 'accepted', qty: line.acceptedQty }
  return status === 'pending' ? { kind: 'pending' } : { kind: 'rejected' }
}

type ViewerT = {
  viewerLanguage: LanguageT
  isManagement: boolean
  sectionTranslations: SectionTranslationMapT
}

export function buildReportPreview(
  { report, lines, media }: ReportPreviewReadT,
  { viewerLanguage, isManagement, sectionTranslations }: ViewerT,
): ReportPreviewT {
  // Management reads the rozpiska as the owner wrote it, whatever its own account says.
  const language: LanguageT = isManagement ? 'pl' : viewerLanguage
  const workerLanguage = report.workerLanguage ?? undefined

  const sectionNameFor = (name: string) =>
    isTranslationLanguage(language)
      ? (renderSectionName(name, sectionTranslations[sectionNameKey(name)], language) ?? name)
      : name

  const toLine = (line: ReportPreviewLineRowT): ReportPreviewLineT => {
    const reported = {
      description: line.description,
      polishDescription: line.polishDescription ?? undefined,
      descriptionLanguage: line.descriptionLanguage ?? undefined,
    }
    const polish =
      line.kind === 'extra'
        ? (line.polishDescription ?? line.description)
        : (line.itemDescription ?? line.description)
    const ownWords =
      line.kind === 'extra'
        ? line.description
        : (isTranslationLanguage(language)
            ? translationText(line.descriptionTranslations, language)
            : '') || polish
    const sectionName = line.sectionName ?? ''
    return {
      id: line.id,
      kind: line.kind,
      ref: line.ref ?? undefined,
      scannedRef: line.scannedRef ?? undefined,
      sectionName: sectionName ? sectionNameFor(sectionName) : '',
      sectionColor: line.sectionColor,
      description: isManagement ? polish : ownWords,
      ...(isManagement
        ? workerDescriptionOf(reported, line.descriptionTranslations, workerLanguage)
        : { workerDescription: undefined, workerDescriptionLanguage: undefined }),
      unit: translateUnit(line.unit, language),
      reportedQty: line.reportedQty,
      outcome: outcomeOf(line, report.status),
    }
  }

  // A line without a live sekcja (a deleted pozycja, an extra nobody took) sorts after the rozpiska.
  const sorted = lines.toSorted(
    (first, second) =>
      (first.sectionOrder ?? Infinity) - (second.sectionOrder ?? Infinity) ||
      first.position - second.position,
  )

  return {
    id: report.id,
    investmentId: report.investmentId,
    investmentName: report.investmentName,
    workerName: report.workerName,
    status: report.status,
    source: report.source,
    createdByName: report.createdByName ?? undefined,
    sentAt: report.sentAt,
    decidedAt: report.decidedAt ?? undefined,
    decidedByName: report.decidedByName ?? undefined,
    lineCount: report.lineCount,
    acceptedLineCount: report.acceptedLineCount,
    photos: media,
    lines: sorted.map(toLine),
  }
}
