import { sectionColorRail, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'

export const reportRowClassName = (color: SectionColorKeyT | null, isActive: boolean) =>
  cn('worker-report-rail', sectionColorRail(color), isActive && 'bg-primary/5')
