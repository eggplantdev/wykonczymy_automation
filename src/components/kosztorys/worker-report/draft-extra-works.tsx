import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import { useTranslation } from '@/hooks/use-translation'
import { translateUnit } from '@/lib/kosztorys/worker-view/translate-unit'

// The blank row the dialog opens on is not a work yet.
export function DraftExtraWorks({ extras }: { extras: ExtraWorkT[] }) {
  const { t, locale } = useTranslation('report')
  const listed = extras.filter((extra) => extra.description.trim() !== '')
  if (listed.length === 0) return null
  return (
    <section className="flex flex-col gap-2 px-4 pt-6">
      <h2 className="text-sm font-semibold">{t('extrasTitle')}</h2>
      <ul className="divide-border flex flex-col divide-y text-sm">
        {listed.map((extra) => (
          <li key={extra.key} className="flex items-center justify-between gap-4 py-2">
            <span className="min-w-0 break-words">{extra.description}</span>
            <span className="whitespace-nowrap tabular-nums">
              {extra.qty} {translateUnit(extra.unit, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
