import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { NewRowT } from '@/lib/kosztorys/create-item'

export type CreatedSectionT = { section: NewRowT }

export async function createSection(
  payload: Payload,
  {
    investmentId,
    displayOrder,
    req,
  }: { investmentId: number; displayOrder: number; req?: PayloadRequest },
): Promise<CreatedSectionT> {
  const section = await payload.create({
    collection: 'kosztorys-sections',
    req,
    data: {
      investment: investmentId,
      name: DEFAULT_SECTION_NAME,
      displayOrder,
    },
  })
  return { section: { id: section.id, displayOrder } }
}
