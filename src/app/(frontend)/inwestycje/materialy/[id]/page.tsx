import { notFound } from 'next/navigation'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { findMaterial } from '@/lib/materials/price-list'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { MaterialDetail } from '@/components/investments/materials/material-detail'
import { PageWrapper } from '@/components/ui/page-wrapper'
import type { DynamicPagePropsT } from '@/types/page'

export default async function MaterialPage({ params }: DynamicPagePropsT) {
  await requireManagementPage()
  const { id } = await params
  const material = findMaterial(id)
  if (!material) notFound()

  const refData = await fetchReferenceData()
  const investmentNames = new Map(
    [...refData.investments, ...refData.trashedInvestments].map((investment) => [
      investment.id,
      investment.name,
    ]),
  )

  return (
    <PageWrapper title={PAGE_TITLES.materials}>
      <MaterialDetail material={material} investmentNames={investmentNames} />
    </PageWrapper>
  )
}
