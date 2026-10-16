import type { Payload } from 'payload'
import {
  parseSheetColumnMapping,
  type SheetColumnMappingT,
} from '@/lib/kosztorys/sheet-import/sheet-column-mapping'

export const MISSING_SHEET = 'Inwestycja nie ma kosztorysu.'

export type InvestmentSheetT = {
  id: number
  googleSheetId: string
  sheetColumnMapping: SheetColumnMappingT
}

export async function getInvestmentSheet(
  payload: Payload,
  investmentId: number,
): Promise<InvestmentSheetT | undefined> {
  const found = await payload.find({
    collection: 'kosztoryses',
    where: { investment: { equals: investmentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const sheet = found.docs[0]
  if (!sheet?.googleSheetId) return undefined
  return {
    id: sheet.id,
    googleSheetId: sheet.googleSheetId,
    sheetColumnMapping: parseSheetColumnMapping(sheet.sheetColumnMapping),
  }
}

export async function getInvestmentSheetId(
  payload: Payload,
  investmentId: number,
): Promise<string | undefined> {
  return (await getInvestmentSheet(payload, investmentId))?.googleSheetId
}
