import { describe, expect, it } from 'vitest'
import { evaluateImportGate } from '@/components/kosztorys/editor/dialogs/sheet/sheet-import-gate'
import type { ImportPreviewT } from '@/lib/actions/kosztorys-import'
import type { FooterComparisonT } from '@/lib/kosztorys/sheet-import/footer-totals'

const matchingTotal: FooterComparisonT = {
  key: 'plannedNet',
  label: 'wartość netto',
  sheetValue: 1000,
  appValue: 1000,
  delta: 0,
  matches: true,
  matchedAgainst: 'plannedNet',
}

function preview(overrides: Partial<ImportPreviewT> = {}): ImportPreviewT {
  return {
    problems: [],
    columns: { missingFields: [], candidates: [], pointedFields: [] },
    failure: null,
    report: {
      missingColumns: [],
      counts: { sections: 2, items: 9, stages: 3 },
      rateDecisions: [],
      coeffs: { wTools: null, ownTools: null },
      dropped: [],
      totals: [matchingTotal],
      warnings: [],
    },
    ...overrides,
  }
}

describe('evaluateImportGate', () => {
  it('lets the import through once a clean preview has loaded', () => {
    const gate = evaluateImportGate(preview(), true, false)

    expect(gate.confirmDisabled).toBe(false)
    expect(gate.mismatchedTotals).toEqual([])
  })

  it('blocks the import while the sheet is still being read', () => {
    expect(evaluateImportGate(null, false, false).confirmDisabled).toBe(true)
  })

  it('blocks the import when the sheet could not be read at all', () => {
    expect(evaluateImportGate(null, true, false).confirmDisabled).toBe(true)
  })

  it('blocks the import when a column could not be resolved', () => {
    const gate = evaluateImportGate(
      preview({ problems: ['Nie znalazłem kolumny „Cena j.m." w zakładce kosztorys_robocizny.'] }),
      true,
      false,
    )

    expect(gate.confirmDisabled).toBe(true)
  })

  it('lets the import through when only an optional column went unresolved', () => {
    // An optional column nobody recognised is data quietly missing from the kosztorys, not a refusal
    // to read the sheet — the pick offered beside it is an improvement, never a gate.
    const gate = evaluateImportGate(
      preview({
        columns: {
          missingFields: [{ field: 'comment', required: false, reason: 'absent' }],
          candidates: [],
          pointedFields: [],
        },
      }),
      true,
      false,
    )

    expect(gate.confirmDisabled).toBe(false)
  })

  it('blocks the import when the sheet itself could not be reached', () => {
    // The failure travels as data so the dialog can render the address to share the sheet with, so a
    // loaded preview is not proof the sheet was read.
    const gate = evaluateImportGate(
      preview({ failure: { reason: 'forbidden', serviceAccountEmail: 'sa@example.iam' } }),
      true,
      false,
    )

    expect(gate.confirmDisabled).toBe(true)
  })

  it('reports a total the sheet and the app disagree on without blocking the import', () => {
    const mismatch: FooterComparisonT = {
      key: 'executedNet',
      label: 'R netto - suma prac wykonannych',
      sheetValue: 900,
      appValue: 1000,
      delta: -100,
      matches: false,
      matchedAgainst: null,
    }
    const gate = evaluateImportGate(
      preview({
        report: { ...preview().report, totals: [matchingTotal, mismatch] },
      }),
      true,
      false,
    )

    expect(gate.mismatchedTotals).toEqual([mismatch])
    expect(gate.confirmDisabled).toBe(false)
  })

  it('does not call a footer row it never found a disagreement', () => {
    // A sheet with no „R netto" row says nothing about whether the parse was right, so it must not
    // raise the „sumy się nie zgadzają" warning — which would train the owner to ignore it.
    const notFound: FooterComparisonT = {
      key: 'executedNet',
      label: 'R netto - suma prac wykonannych',
      sheetValue: null,
      appValue: 1000,
      delta: null,
      matches: false,
      matchedAgainst: null,
    }
    const gate = evaluateImportGate(
      preview({ report: { ...preview().report, totals: [matchingTotal, notFound] } }),
      true,
      false,
    )

    expect(gate.mismatchedTotals).toEqual([])
  })

  it('blocks a second press while the first import is still running', () => {
    expect(evaluateImportGate(preview(), true, true).confirmDisabled).toBe(true)
  })
})
