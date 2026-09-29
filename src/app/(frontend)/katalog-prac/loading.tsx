import { TitledPageLoading } from '@/components/ui/loader/page-loading'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default function Loading() {
  return <TitledPageLoading title={PAGE_TITLES.workCatalog} />
}
