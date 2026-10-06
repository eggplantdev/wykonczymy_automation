import { generateObject } from 'ai'
import { RECEIPT_MODEL, RECEIPT_TIMEOUT_MS, type ReceiptPageT } from './openrouter'
import { openrouter, timeoutSignal, withModelFallback } from './openrouter-client'
import { providerErrorDetail } from './provider-error-detail'
import { workerReportScanSchema, type ScanUnitT } from './worker-report-scan-schema'
import type { ScanPageT } from '@/lib/kosztorys/worker-report/types'

// Server-only through `./openrouter-client`: never pull it into the Payload CLI graph.

/** One photo of the „Drukuj do wypełnienia" form → the rows and extras written on it. */
export async function readWorkerReportPage(
  page: ReceiptPageT,
  { units }: { units: readonly ScanUnitT[] },
): Promise<ScanPageT> {
  const promptText = [
    'This is a photo of a printed work-report form that a construction worker filled in by hand.',
    'The printed table lists work items. Each row starts with a small grey number such as',
    '"35812-7", then a description and a unit; the worker writes the quantity done in the last',
    'column. Below the table there are blank rows where he may handwrite extra work.',
    '',
    'rows: ONLY printed rows that have a handwritten quantity. Skip rows left empty.',
    '- ref: the grey number exactly as printed, including the part after the dash.',
    '- qty: the handwritten quantity as a number. A comma is a decimal separator: "2,5" is 2.5.',
    '- isUncertain: true when a digit of the quantity or of the ref is unclear — still give your',
    '  best guess, never skip the row for it.',
    '- description: the printed description of that row, verbatim.',
    '',
    'extras: handwritten lines in the blank rows, one per line with a quantity.',
    '- description: verbatim, in whatever language it is written; do not translate.',
    '- unit: one value from the list below — the part BEFORE " — ", which is what to return even',
    '  when the worker wrote the translation after it. null when the written unit fits none.',
    '- qty and isUncertain: as for rows.',
    '',
    'If the photo is not this form, or nothing is filled in, return empty rows and extras.',
    '',
    'Units:',
    ...units.map((unit) => unit.label),
  ].join('\n')

  async function callModel(model: string): Promise<ScanPageT> {
    const result = await generateObject({
      model: openrouter(model),
      abortSignal: timeoutSignal(RECEIPT_TIMEOUT_MS, 'worker report scan'),
      schema: workerReportScanSchema(units),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            {
              type: 'file',
              data: page.bytes,
              mediaType: page.mediaType,
              filename: page.filename,
            },
          ],
        },
      ],
    })
    return result.object
  }

  try {
    return await withModelFallback('worker-report-scan', RECEIPT_MODEL, callModel)
  } catch (error) {
    // TODO(EX-449) SENTRY-REQUIRED: a failed paper read is a silent provider error the kierownik
    // can't self-report.
    throw new Error(providerErrorDetail(error, 'Błąd odczytu kartki'))
  }
}
