import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { NewRowT } from '@/lib/kosztorys/create-item'

export type CreatedSectionT = { section: NewRowT }

// A bare section: a sekcja bez pozycji is a state the editor draws (a header band alone), so nothing
// is seeded to make it visible. Every path that mints one — append and insert-at — goes through here.
//
// No etap is seeded — a stage's plane is forced at creation (addStageAction) and a guess would read
// as confirmed while nobody chose it, while an unconfirmed (null) one drops out of both
// subcontractor views.
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
